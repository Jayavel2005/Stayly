import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { GlobalExceptionFilter, TransformInterceptor } from '../src/common';
import { NotificationType } from '../src/modules/notifications/types/notification-type.enum';
import { BookingStatus } from '../src/modules/bookings/types/booking-status.enum';

describe('Notifications System (e2e)', () => {
  let app: INestApplication;
  let server: App;
  let prisma: PrismaService;

  let customerAToken: string;
  let customerBToken: string;
  let managerToken: string;
  let adminToken: string;

  let customerAUserId: string;
  const customerBUserId = '22222222-2222-4222-8222-222222222266';
  const managerUserId = '33333333-3333-4333-8333-333333333333';
  const HOTEL_MUMBAI_ID = '44444444-4444-4444-8444-444444444444';
  const UNASSIGNED_HOTEL_ID = '77777777-7777-4777-8777-777777777777';

  const createdNotificationIds: string[] = [];
  const createdBookingIds: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );

    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor());

    await app.init();
    server = app.getHttpServer() as App;
    prisma = app.get<PrismaService>(PrismaService);

    const passwordHash = await bcrypt.hash('Password123!', 10);

    // 1. Log in existing Customer A
    const resCustA = await request(server)
      .post('/api/v1/auth/customer/login')
      .send({ email: 'customer@stayora.com', password: 'Password123!' });
    customerAToken = resCustA.body.data.accessToken;

    const userA = await prisma.user.findFirst({
      where: { email: 'customer@stayora.com' },
    });
    customerAUserId = userA!.id;

    // 2. Ensure Customer B exists and log in
    await prisma.user.upsert({
      where: { id: customerBUserId },
      update: { email: 'customer.notif.b@stayora.com', passwordHash },
      create: {
        id: customerBUserId,
        email: 'customer.notif.b@stayora.com',
        passwordHash,
        firstName: 'Ananya',
        lastName: 'Deshmukh',
        role: 'CUSTOMER',
        status: 'ACTIVE',
      },
    });

    const resCustB = await request(server)
      .post('/api/v1/auth/customer/login')
      .send({ email: 'customer.notif.b@stayora.com', password: 'Password123!' });
    customerBToken = resCustB.body.data.accessToken;

    // 3. Log in Manager
    const resManager = await request(server)
      .post('/api/v1/auth/manager/login')
      .send({ email: 'manager@stayora.com', password: 'Password123!' });
    managerToken = resManager.body.data.accessToken;

    // 4. Log in Admin
    const resAdmin = await request(server)
      .post('/api/v1/auth/admin/login')
      .send({ email: 'admin@stayora.com', password: 'Password123!' });
    adminToken = resAdmin.body.data.accessToken;
  });

  afterAll(async () => {
    // Cleanup notifications
    if (createdNotificationIds.length > 0) {
      await prisma.notification.deleteMany({
        where: { id: { in: createdNotificationIds } },
      });
    }

    // Cleanup bookings & reviews
    if (createdBookingIds.length > 0) {
      await prisma.review.deleteMany({
        where: { bookingId: { in: createdBookingIds } },
      });
      await prisma.paymentAttempt.deleteMany({
        where: { bookingId: { in: createdBookingIds } },
      });
      await prisma.payment.deleteMany({
        where: { bookingId: { in: createdBookingIds } },
      });
      await prisma.bookingRoom.deleteMany({
        where: { bookingId: { in: createdBookingIds } },
      });
      await prisma.bookingPriceSnapshot.deleteMany({
        where: { bookingId: { in: createdBookingIds } },
      });
      await prisma.booking.deleteMany({
        where: { id: { in: createdBookingIds } },
      });
    }

    await app.close();
  });

  // Helper to create a direct notification in DB
  async function createTestNotification(
    userId: string,
    type: string = NotificationType.BOOKING_CONFIRMED,
    title: string = 'Test Notification',
    message: string = 'This is a test notification message.',
    isRead: boolean = false,
  ): Promise<string> {
    const notif = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        isRead,
        readAt: isRead ? new Date() : null,
      },
    });

    createdNotificationIds.push(notif.id);
    return notif.id;
  }

  // ===========================================================================
  // 1. Notification Retrieval & Ownership
  // ===========================================================================
  describe('Notification Retrieval & Ownership (IDOR Defense)', () => {
    it('allows customer to view their own notifications', async () => {
      const notifId = await createTestNotification(
        customerAUserId,
        NotificationType.BOOKING_CREATED,
        'Booking Created',
      );

      const res = await request(server)
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${customerAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(res.body.data.meta).toBeDefined();

      const found = res.body.data.items.find((i: any) => i.id === notifId);
      expect(found).toBeDefined();
      expect(found.title).toBe('Booking Created');
    });

    it('prevents customer from seeing another customer notifications in list', async () => {
      const notifBId = await createTestNotification(
        customerBUserId,
        NotificationType.BOOKING_CREATED,
        'Customer B Private Alert',
      );

      const res = await request(server)
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${customerAToken}`);

      expect(res.status).toBe(200);
      const found = res.body.data.items.find((i: any) => i.id === notifBId);
      expect(found).toBeUndefined();
    });

    it('prevents customer from viewing another customer notification by ID (IDOR Defense)', async () => {
      const notifBId = await createTestNotification(
        customerBUserId,
        NotificationType.PAYMENT_SUCCESS,
        'Private Payment Receipt',
      );

      const res = await request(server)
        .get(`/api/v1/notifications/${notifBId}`)
        .set('Authorization', `Bearer ${customerAToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOTIFICATION_NOT_FOUND');
    });

    it('rejects unauthenticated requests with 401', async () => {
      const res = await request(server).get('/api/v1/notifications');
      expect(res.status).toBe(401);
    });
  });

  // ===========================================================================
  // 2. Read State & Idempotency
  // ===========================================================================
  describe('Read State & Idempotency', () => {
    it('marks an unread notification as read and sets readAt timestamp', async () => {
      const notifId = await createTestNotification(
        customerAUserId,
        NotificationType.BOOKING_CONFIRMED,
        'Mark Read Test',
        'Unread notification to be marked read',
        false,
      );

      const res = await request(server)
        .patch(`/api/v1/notifications/${notifId}/read`)
        .set('Authorization', `Bearer ${customerAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.isRead).toBe(true);
      expect(res.body.data.readAt).toBeDefined();

      // Verify in database
      const dbNotif = await prisma.notification.findUnique({
        where: { id: notifId },
      });
      expect(dbNotif!.isRead).toBe(true);
      expect(dbNotif!.readAt).not.toBeNull();
    });

    it('is idempotent when marking an already-read notification as read', async () => {
      const notifId = await createTestNotification(
        customerAUserId,
        NotificationType.BOOKING_CONFIRMED,
        'Already Read Test',
        'Notification that is already read',
        true,
      );

      const res = await request(server)
        .patch(`/api/v1/notifications/${notifId}/read`)
        .set('Authorization', `Bearer ${customerAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.isRead).toBe(true);
    });

    it('forbids marking another customer notification as read', async () => {
      const notifBId = await createTestNotification(
        customerBUserId,
        NotificationType.PAYMENT_SUCCESS,
        'Customer B Notification',
      );

      const res = await request(server)
        .patch(`/api/v1/notifications/${notifBId}/read`)
        .set('Authorization', `Bearer ${customerAToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOTIFICATION_NOT_FOUND');
    });
  });

  // ===========================================================================
  // 3. Mark All Read & Unread Count
  // ===========================================================================
  describe('Mark All Read & Unread Count', () => {
    it('accurately reports unread count and marks all as read', async () => {
      // Create 3 unread and 1 read for Customer A
      await createTestNotification(customerAUserId, NotificationType.BOOKING_CREATED, 'Unread 1', 'msg', false);
      await createTestNotification(customerAUserId, NotificationType.PAYMENT_SUCCESS, 'Unread 2', 'msg', false);
      await createTestNotification(customerAUserId, NotificationType.CHECK_IN_COMPLETED, 'Unread 3', 'msg', false);
      await createTestNotification(customerAUserId, NotificationType.SYSTEM, 'Read 1', 'msg', true);

      // 1. Check unread count
      const countRes1 = await request(server)
        .get('/api/v1/notifications/unread-count')
        .set('Authorization', `Bearer ${customerAToken}`);

      expect(countRes1.status).toBe(200);
      expect(countRes1.body.data.count).toBeGreaterThanOrEqual(3);

      // 2. Mark all as read
      const markAllRes = await request(server)
        .patch('/api/v1/notifications/read-all')
        .set('Authorization', `Bearer ${customerAToken}`);

      expect(markAllRes.status).toBe(200);
      expect(markAllRes.body.success).toBe(true);
      expect(markAllRes.body.count).toBeGreaterThanOrEqual(3);

      // 3. Verify unread count is now 0
      const countRes2 = await request(server)
        .get('/api/v1/notifications/unread-count')
        .set('Authorization', `Bearer ${customerAToken}`);

      expect(countRes2.status).toBe(200);
      expect(countRes2.body.data.count).toBe(0);
    });
  });

  // ===========================================================================
  // 4. Pagination & Filtering
  // ===========================================================================
  describe('Pagination & Filtering', () => {
    it('supports isRead filter and database pagination', async () => {
      await createTestNotification(customerAUserId, NotificationType.BOOKING_CREATED, 'Paginated 1', 'msg', false);
      await createTestNotification(customerAUserId, NotificationType.PAYMENT_SUCCESS, 'Paginated 2', 'msg', true);

      // Filter unread only
      const unreadRes = await request(server)
        .get('/api/v1/notifications?isRead=false&limit=10')
        .set('Authorization', `Bearer ${customerAToken}`);

      expect(unreadRes.status).toBe(200);
      unreadRes.body.data.items.forEach((item: any) => {
        expect(item.isRead).toBe(false);
      });

      // Filter read only
      const readRes = await request(server)
        .get('/api/v1/notifications?isRead=true&limit=10')
        .set('Authorization', `Bearer ${customerAToken}`);

      expect(readRes.status).toBe(200);
      readRes.body.data.items.forEach((item: any) => {
        expect(item.isRead).toBe(true);
      });
    });
  });

  // ===========================================================================
  // 5. Domain Events Integration & Manager Isolation
  // ===========================================================================
  describe('Domain Events Integration & Manager Isolation', () => {
    it('dispatches notifications when a review is submitted to assigned manager', async () => {
      // 1. Create completed booking for Customer A
      const checkIn = new Date('2026-09-01T14:00:00.000Z');
      const checkOut = new Date('2026-09-03T11:00:00.000Z');
      const ref = `BK-NTF-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`;

      const booking = await prisma.booking.create({
        data: {
          bookingReference: ref,
          customerId: customerAUserId,
          hotelId: HOTEL_MUMBAI_ID,
          status: BookingStatus.CHECKED_OUT,
          checkInDate: checkIn,
          checkOutDate: checkOut,
          totalNights: 2,
          totalGuests: 2,
          totalAmountCents: BigInt(1000000),
          currency: 'INR',
          priceSnapshot: {
            create: {
              baseRateCents: BigInt(500000),
              totalNights: 2,
              grossRoomCents: BigInt(1000000),
              taxCents: BigInt(0),
              netAmountCents: BigInt(1000000),
              currency: 'INR',
            },
          },
        },
      });
      createdBookingIds.push(booking.id);

      // 2. Submit Review
      const revRes = await request(server)
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          bookingId: booking.id,
          rating: 5,
          title: 'Marvelous Stay',
          comment: 'Outstanding staff hospitality and cleanliness.',
        });

      expect(revRes.status).toBe(201);

      // 3. Manager of Mumbai hotel should receive REVIEW_CREATED notification
      const mgrNotifsRes = await request(server)
        .get('/api/v1/notifications?limit=20')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(mgrNotifsRes.status).toBe(200);
      const reviewNotif = mgrNotifsRes.body.data.items.find(
        (n: any) => n.type === NotificationType.REVIEW_CREATED,
      );
      expect(reviewNotif).toBeDefined();
      expect(reviewNotif.title).toBe('New Review Submitted');
    });

    it('dispatches notifications upon booking cancellation to customer and assigned manager', async () => {
      // 1. Create a confirmed booking for Customer A
      const checkIn = new Date('2026-11-01T14:00:00.000Z');
      const checkOut = new Date('2026-11-03T11:00:00.000Z');
      const ref = `BK-CNL-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`;

      const booking = await prisma.booking.create({
        data: {
          bookingReference: ref,
          customerId: customerAUserId,
          hotelId: HOTEL_MUMBAI_ID,
          status: BookingStatus.CONFIRMED,
          checkInDate: checkIn,
          checkOutDate: checkOut,
          totalNights: 2,
          totalGuests: 2,
          totalAmountCents: BigInt(1200000),
          currency: 'INR',
          priceSnapshot: {
            create: {
              baseRateCents: BigInt(600000),
              totalNights: 2,
              grossRoomCents: BigInt(1200000),
              taxCents: BigInt(0),
              netAmountCents: BigInt(1200000),
              currency: 'INR',
            },
          },
        },
      });
      createdBookingIds.push(booking.id);

      // 2. Cancel booking
      const cancelRes = await request(server)
        .post(`/api/v1/bookings/${booking.id}/cancel`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ reason: 'Trip rescheduled' });

      expect(cancelRes.status).toBe(200);

      // 3. Customer should receive BOOKING_CANCELLED notification
      const custNotifsRes = await request(server)
        .get('/api/v1/notifications?limit=10')
        .set('Authorization', `Bearer ${customerAToken}`);

      expect(custNotifsRes.status).toBe(200);
      const custCancelNotif = custNotifsRes.body.data.items.find(
        (n: any) => n.type === NotificationType.BOOKING_CANCELLED,
      );
      expect(custCancelNotif).toBeDefined();

      // 4. Assigned Manager should receive BOOKING_CANCELLED notification
      const mgrNotifsRes = await request(server)
        .get('/api/v1/notifications?limit=10')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(mgrNotifsRes.status).toBe(200);
      const mgrCancelNotif = mgrNotifsRes.body.data.items.find(
        (n: any) => n.type === NotificationType.BOOKING_CANCELLED,
      );
      expect(mgrCancelNotif).toBeDefined();
    });

    it('dispatches notifications upon check-in and check-out lifecycle transitions', async () => {
      // 1. Create a confirmed booking for Customer A
      const checkIn = new Date('2026-10-01T14:00:00.000Z');
      const checkOut = new Date('2026-10-03T11:00:00.000Z');
      const ref = `BK-CHK-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`;

      const booking = await prisma.booking.create({
        data: {
          bookingReference: ref,
          customerId: customerAUserId,
          hotelId: HOTEL_MUMBAI_ID,
          status: BookingStatus.CONFIRMED,
          checkInDate: checkIn,
          checkOutDate: checkOut,
          totalNights: 2,
          totalGuests: 2,
          totalAmountCents: BigInt(1200000),
          currency: 'INR',
          priceSnapshot: {
            create: {
              baseRateCents: BigInt(600000),
              totalNights: 2,
              grossRoomCents: BigInt(1200000),
              taxCents: BigInt(0),
              netAmountCents: BigInt(1200000),
              currency: 'INR',
            },
          },
        },
      });
      createdBookingIds.push(booking.id);

      // 2. Manager checks in guest
      const checkInRes = await request(server)
        .post(`/api/v1/bookings/${booking.id}/check-in`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(checkInRes.status).toBe(200);

      // Verify customer received CHECK_IN_COMPLETED
      const custRes1 = await request(server)
        .get('/api/v1/notifications?limit=10')
        .set('Authorization', `Bearer ${customerAToken}`);
      const checkInNotif = custRes1.body.data.items.find(
        (n: any) => n.type === NotificationType.CHECK_IN_COMPLETED,
      );
      expect(checkInNotif).toBeDefined();

      // 3. Manager checks out guest
      const checkOutRes = await request(server)
        .post(`/api/v1/bookings/${booking.id}/check-out`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(checkOutRes.status).toBe(200);

      // Verify customer received CHECK_OUT_COMPLETED
      const custRes2 = await request(server)
        .get('/api/v1/notifications?limit=10')
        .set('Authorization', `Bearer ${customerAToken}`);
      const checkOutNotif = custRes2.body.data.items.find(
        (n: any) => n.type === NotificationType.CHECK_OUT_COMPLETED,
      );
      expect(checkOutNotif).toBeDefined();
    });

    it('dispatches payment success & failure notifications', async () => {
      // 1. Create a pending booking for Customer A
      const checkIn = new Date('2026-12-01T14:00:00.000Z');
      const checkOut = new Date('2026-12-03T11:00:00.000Z');
      const ref = `BK-PAY-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`;

      const booking = await prisma.booking.create({
        data: {
          bookingReference: ref,
          customerId: customerAUserId,
          hotelId: HOTEL_MUMBAI_ID,
          status: BookingStatus.PENDING,
          checkInDate: checkIn,
          checkOutDate: checkOut,
          totalNights: 2,
          totalGuests: 2,
          totalAmountCents: BigInt(800000),
          currency: 'INR',
          holdExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
          priceSnapshot: {
            create: {
              baseRateCents: BigInt(400000),
              totalNights: 2,
              grossRoomCents: BigInt(800000),
              taxCents: BigInt(0),
              netAmountCents: BigInt(800000),
              currency: 'INR',
            },
          },
        },
      });
      createdBookingIds.push(booking.id);

      // 2. Process simulated failing payment
      const failRes = await request(server)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${customerAToken}`)
        .set('Idempotency-Key', `IDEMP-FAIL-${Date.now()}`)
        .send({
          bookingId: booking.id,
          simulateResult: 'FAILED',
        });

      expect(failRes.status).toBe(201);
      expect(failRes.body.data.status).toBe('FAILED');

      // Verify customer received PAYMENT_FAILED notification
      const custResFail = await request(server)
        .get('/api/v1/notifications?limit=10')
        .set('Authorization', `Bearer ${customerAToken}`);
      const payFailNotif = custResFail.body.data.items.find(
        (n: any) => n.type === NotificationType.PAYMENT_FAILED,
      );
      expect(payFailNotif).toBeDefined();

      // 3. Process simulated successful payment
      const successRes = await request(server)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${customerAToken}`)
        .set('Idempotency-Key', `IDEMP-SUCCESS-${Date.now()}`)
        .send({
          bookingId: booking.id,
          simulateResult: 'SUCCESS',
        });

      expect(successRes.status).toBe(201);
      expect(successRes.body.data.status).toBe('SUCCEEDED');

      // Verify customer received PAYMENT_SUCCESS and BOOKING_CONFIRMED notifications
      const custResSuccess = await request(server)
        .get('/api/v1/notifications?limit=10')
        .set('Authorization', `Bearer ${customerAToken}`);

      const paySuccessNotif = custResSuccess.body.data.items.find(
        (n: any) => n.type === NotificationType.PAYMENT_SUCCESS,
      );
      expect(paySuccessNotif).toBeDefined();

      const bookingConfNotif = custResSuccess.body.data.items.find(
        (n: any) => n.type === NotificationType.BOOKING_CONFIRMED,
      );
      expect(bookingConfNotif).toBeDefined();
    });
  });
});

