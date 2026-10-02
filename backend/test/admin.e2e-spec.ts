import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { GlobalExceptionFilter, TransformInterceptor } from '../src/common';
import { UserRole, UserStatus } from '../src/modules/auth/types/user-role.enum';

describe('Admin Operations & Platform Management (e2e)', () => {
  let app: INestApplication;
  let server: App;
  let prisma: PrismaService;

  let customerToken: string;
  let managerToken: string;
  let adminToken: string;
  let adminUserId: string;

  let testHotelId: string;
  let testManagerId: string;
  let testCustomerId: string;
  let testBookingId: string;
  let testPaymentId: string;
  let testReviewId: string;

  const testIdsToClean = {
    users: [] as string[],
    hotels: [] as string[],
    bookings: [] as string[],
    reviews: [] as string[],
  };

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

    // 1. Authenticate Customer
    const resCust = await request(server)
      .post('/api/v1/auth/customer/login')
      .send({ email: 'customer@stayora.com', password: 'Password123!' });
    customerToken = resCust.body.data.accessToken;

    // 2. Authenticate Manager
    const resMgr = await request(server)
      .post('/api/v1/auth/manager/login')
      .send({ email: 'manager@stayora.com', password: 'Password123!' });
    managerToken = resMgr.body.data.accessToken;

    // 3. Authenticate Admin
    const resAdmin = await request(server)
      .post('/api/v1/auth/admin/login')
      .send({ email: 'admin@stayora.com', password: 'Password123!' });
    adminToken = resAdmin.body.data.accessToken;
    adminUserId = resAdmin.body.data.user.id;

    // 4. Create dedicated test fixtures
    testCustomerId = 'a1111111-1111-4111-8111-111111111111';
    await prisma.user.upsert({
      where: { id: testCustomerId },
      update: { passwordHash, status: UserStatus.ACTIVE },
      create: {
        id: testCustomerId,
        email: 'customer.admin.test@stayora.com',
        passwordHash,
        firstName: 'Test',
        lastName: 'Customer',
        role: UserRole.CUSTOMER,
        status: UserStatus.ACTIVE,
      },
    });
    testIdsToClean.users.push(testCustomerId);

    testManagerId = 'a2222222-2222-4222-8222-222222222222';
    await prisma.user.upsert({
      where: { id: testManagerId },
      update: { passwordHash, status: UserStatus.ACTIVE },
      create: {
        id: testManagerId,
        email: 'manager.admin.test@stayora.com',
        passwordHash,
        firstName: 'Assigned',
        lastName: 'Manager',
        role: UserRole.HOTEL_MANAGER,
        status: UserStatus.ACTIVE,
      },
    });
    testIdsToClean.users.push(testManagerId);

    // Retrieve a seeded hotel or create one
    const seededHotel = await prisma.hotel.findFirst({
      where: { deletedAt: null },
      include: {
        roomTypes: {
          include: { rooms: true },
        },
      },
    });

    if (!seededHotel || !seededHotel.roomTypes[0] || !seededHotel.roomTypes[0].rooms[0]) {
      throw new Error('Required seeded hotel test fixtures not found');
    }

    testHotelId = seededHotel.id;
    const testRoomTypeId = seededHotel.roomTypes[0].id;
    const testRoomId = seededHotel.roomTypes[0].rooms[0].id;

    // Create a confirmed booking with payment & review for inspection tests
    const booking = await prisma.booking.create({
      data: {
        bookingReference: `ADM-${Date.now().toString().slice(-6)}`,
        customerId: testCustomerId,
        hotelId: testHotelId,
        status: 'CONFIRMED',
        checkInDate: new Date('2027-08-01'),
        checkOutDate: new Date('2027-08-04'),
        totalNights: 3,
        totalGuests: 1,
        totalAmountCents: BigInt(3000000),
        currency: 'INR',
        bookingRooms: {
          create: {
            roomId: testRoomId,
            roomTypeId: testRoomTypeId,
            checkInDate: new Date('2027-08-01'),
            checkOutDate: new Date('2027-08-04'),
            status: 'RESERVED',
          },
        },
        priceSnapshot: {
          create: {
            baseRateCents: BigInt(1000000),
            totalNights: 3,
            grossRoomCents: BigInt(3000000),
            taxCents: BigInt(0),
            serviceFeeCents: BigInt(0),
            discountCents: BigInt(0),
            netAmountCents: BigInt(3000000),
            currency: 'INR',
          },
        },
      },
    });
    testBookingId = booking.id;
    testIdsToClean.bookings.push(testBookingId);

    const payment = await prisma.payment.create({
      data: {
        bookingId: testBookingId,
        transactionReference: `TX-ADM-${Date.now()}`,
        amountCents: BigInt(3000000),
        currency: 'INR',
        status: 'SUCCEEDED',
        gatewayProvider: 'MOCK',
        paymentMethod: 'CARD',
      },
    });
    testPaymentId = payment.id;

    const review = await prisma.review.create({
      data: {
        bookingId: testBookingId,
        customerId: testCustomerId,
        hotelId: testHotelId,
        rating: 5,
        title: 'Outstanding Luxury',
        comment: 'The stay was utterly delightful.',
        isPublished: true,
      },
    });
    testReviewId = review.id;
    testIdsToClean.reviews.push(testReviewId);
  });

  afterAll(async () => {
    // Cleanup created test records
    if (testIdsToClean.reviews.length > 0) {
      await prisma.review.deleteMany({
        where: { id: { in: testIdsToClean.reviews } },
      });
    }

    if (testIdsToClean.bookings.length > 0) {
      await prisma.payment.deleteMany({
        where: { bookingId: { in: testIdsToClean.bookings } },
      });
      await prisma.bookingRoom.deleteMany({
        where: { bookingId: { in: testIdsToClean.bookings } },
      });
      await prisma.bookingPriceSnapshot.deleteMany({
        where: { bookingId: { in: testIdsToClean.bookings } },
      });
      await prisma.booking.deleteMany({
        where: { id: { in: testIdsToClean.bookings } },
      });
    }

    if (testIdsToClean.users.length > 0) {
      await prisma.hotelManager.deleteMany({
        where: { userId: { in: testIdsToClean.users } },
      });
      await prisma.notification.deleteMany({
        where: { userId: { in: testIdsToClean.users } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: testIdsToClean.users } },
      });
    }

    await app.close();
  });

  // ===========================================================================
  // 1. Authorization & RBAC Matrix
  // ===========================================================================

  describe('Authorization & RBAC Matrix', () => {
    it('should reject unauthenticated request to admin endpoints with 401', async () => {
      const res = await request(server).get('/api/v1/admin/dashboard');
      expect(res.status).toBe(401);
    });

    it('should reject CUSTOMER access to admin endpoints with 403 Forbidden', async () => {
      const res = await request(server)
        .get('/api/v1/admin/dashboard')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(res.status).toBe(403);
    });

    it('should reject HOTEL_MANAGER access to admin endpoints with 403 Forbidden', async () => {
      const res = await request(server)
        .get('/api/v1/admin/dashboard')
        .set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(403);
    });

    it('should allow ADMIN access to admin endpoints with 200 OK', async () => {
      const res = await request(server)
        .get('/api/v1/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.users).toBeDefined();
      expect(res.body.data.hotels).toBeDefined();
      expect(res.body.data.bookings).toBeDefined();
    });
  });

  // ===========================================================================
  // 2. Dashboard Overview & Date Filters
  // ===========================================================================

  describe('Admin Dashboard Metrics & Filters', () => {
    it('should return aggregated platform statistics', async () => {
      const res = await request(server)
        .get('/api/v1/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(typeof data.users.totalUsers).toBe('number');
      expect(typeof data.hotels.totalHotels).toBe('number');
      expect(typeof data.inventory.totalRooms).toBe('number');
      expect(typeof data.bookings.totalBookings).toBe('number');
      expect(typeof data.payments.totalRevenueCents).toBe('number');
      expect(typeof data.reviews.totalReviews).toBe('number');
      expect(typeof data.notifications.totalNotifications).toBe('number');
    });

    it('should support optional from and to ISO date filters', async () => {
      const res = await request(server)
        .get(
          '/api/v1/admin/dashboard?from=2026-01-01T00:00:00.000Z&to=2027-12-31T23:59:59.999Z',
        )
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.dateRange.from).toBe('2026-01-01T00:00:00.000Z');
      expect(res.body.data.dateRange.to).toBe('2027-12-31T23:59:59.999Z');
    });

    it('should reject invalid date range where from > to with 400', async () => {
      const res = await request(server)
        .get(
          '/api/v1/admin/dashboard?from=2027-12-31T00:00:00.000Z&to=2026-01-01T00:00:00.000Z',
        )
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
    });
  });

  // ===========================================================================
  // 3. User Management & Self-Protection
  // ===========================================================================

  describe('User Management & Self-Protection', () => {
    it('should list users with pagination and without exposing password hashes', async () => {
      const res = await request(server)
        .get('/api/v1/admin/users?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items).toBeDefined();
      expect(res.body.data.meta.page).toBe(1);
      expect(res.body.data.items.length).toBeGreaterThan(0);

      // Verify NO passwordHash is exposed
      for (const user of res.body.data.items) {
        expect(user.passwordHash).toBeUndefined();
        expect(user.email).toBeDefined();
        expect(user.role).toBeDefined();
      }
    });

    it('should inspect single user details', async () => {
      const res = await request(server)
        .get(`/api/v1/admin/users/${testCustomerId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(testCustomerId);
      expect(res.body.data.passwordHash).toBeUndefined();
      expect(res.body.data._count.bookings).toBeGreaterThanOrEqual(1);
    });

    it('Admin Self-Protection: should reject an admin attempting to modify their own account status', async () => {
      const res = await request(server)
        .patch(`/api/v1/admin/users/${adminUserId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: UserStatus.SUSPENDED, reason: 'Self lock test' });

      expect(res.status).toBe(403);
    });

    it('should suspend a target user and update their account status', async () => {
      const res = await request(server)
        .patch(`/api/v1/admin/users/${testCustomerId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: UserStatus.SUSPENDED, reason: 'Testing suspension' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(UserStatus.SUSPENDED);

      // Restore back to ACTIVE
      const resRestore = await request(server)
        .patch(`/api/v1/admin/users/${testCustomerId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: UserStatus.ACTIVE, reason: 'Testing reactivation' });

      expect(resRestore.status).toBe(200);
      expect(resRestore.body.data.status).toBe(UserStatus.ACTIVE);
    });
  });

  // ===========================================================================
  // 4. Manager Management & Property Assignments
  // ===========================================================================

  describe('Manager Management & Property Assignments', () => {
    it('should list managers and filter strictly to HOTEL_MANAGER role', async () => {
      const res = await request(server)
        .get('/api/v1/admin/managers')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items).toBeDefined();
      for (const mgr of res.body.data.items) {
        expect(['HOTEL_MANAGER', 'MANAGER']).toContain(mgr.role);
      }
    });

    it('should reject manager assignment if target user has CUSTOMER role', async () => {
      const res = await request(server)
        .post(`/api/v1/admin/hotels/${testHotelId}/managers/${testCustomerId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isPrimary: true });

      expect(res.status).toBe(400);
    });

    it('should assign a manager to a hotel property and handle concurrent requests idempotently', async () => {
      // Execute 3 concurrent assignment requests
      const requests = [1, 2, 3].map(() =>
        request(server)
          .post(`/api/v1/admin/hotels/${testHotelId}/managers/${testManagerId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ isPrimary: true }),
      );

      const responses = await Promise.all(requests);
      for (const res of responses) {
        expect([200, 201]).toContain(res.status);
      }

      // Verify only 1 assignment exists in database
      const count = await prisma.hotelManager.count({
        where: { userId: testManagerId, hotelId: testHotelId },
      });
      expect(count).toBe(1);
    });

    it('should unassign manager from hotel property without deleting accounts', async () => {
      const res = await request(server)
        .delete(`/api/v1/admin/hotels/${testHotelId}/managers/${testManagerId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);

      // Verify assignment deleted
      const assignment = await prisma.hotelManager.findUnique({
        where: { userId_hotelId: { userId: testManagerId, hotelId: testHotelId } },
      });
      expect(assignment).toBeNull();

      // Verify manager user account still exists
      const user = await prisma.user.findUnique({ where: { id: testManagerId } });
      expect(user).not.toBeNull();
    });
  });

  // ===========================================================================
  // 5. Hotel Administration & Safe Deactivation
  // ===========================================================================

  describe('Hotel Administration & Safe Deactivation', () => {
    it('should list all hotels platform-wide with aggregate counts', async () => {
      const res = await request(server)
        .get('/api/v1/admin/hotels?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const items = res.body.data.items || res.body.data;
      expect(items).toBeDefined();
      expect(items.length).toBeGreaterThan(0);
      expect(items[0]._count).toBeDefined();
    });

    it('should inspect hotel detail including room types and staff', async () => {
      const res = await request(server)
        .get(`/api/v1/admin/hotels/${testHotelId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(testHotelId);
      expect(res.body.data.roomTypes).toBeDefined();
    });

    it('should safely deactivate hotel while preserving existing active bookings', async () => {
      const resDeactivate = await request(server)
        .patch(`/api/v1/admin/hotels/${testHotelId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: false, reason: 'Temporary maintenance' });

      expect(resDeactivate.status).toBe(200);
      expect(resDeactivate.body.data.isActive).toBe(false);
      expect(resDeactivate.body.data.preservedActiveBookings).toBeGreaterThanOrEqual(1);

      // Verify confirmed test booking is STILL CONFIRMED (not corrupted or cancelled)
      const booking = await prisma.booking.findUnique({ where: { id: testBookingId } });
      expect(booking?.status).toBe('CONFIRMED');

      // Reactivate hotel
      const resReactivate = await request(server)
        .patch(`/api/v1/admin/hotels/${testHotelId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: true, reason: 'Maintenance completed' });

      expect(resReactivate.status).toBe(200);
      expect(resReactivate.body.data.isActive).toBe(true);
    });
  });

  // ===========================================================================
  // 6. Booking & Payment Administration
  // ===========================================================================

  describe('Booking & Payment Inspection', () => {
    it('should list bookings platform-wide with customer and payment references', async () => {
      const res = await request(server)
        .get('/api/v1/admin/bookings')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items).toBeDefined();
      expect(res.body.data.items.length).toBeGreaterThan(0);
    });

    it('should inspect single booking details with room allocation and price snapshot', async () => {
      const res = await request(server)
        .get(`/api/v1/admin/bookings/${testBookingId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(testBookingId);
      expect(res.body.data.bookingRooms).toBeDefined();
      expect(res.body.data.priceSnapshot).toBeDefined();
    });

    it('should list payments without exposing card numbers or sensitive gateway secrets', async () => {
      const res = await request(server)
        .get('/api/v1/admin/payments')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items).toBeDefined();
      for (const p of res.body.data.items) {
        expect(p.cardNumber).toBeUndefined();
        expect(p.cvv).toBeUndefined();
        expect(p.amountCents).toBeDefined();
      }
    });

    it('should inspect payment details with attempts', async () => {
      const res = await request(server)
        .get(`/api/v1/admin/payments/${testPaymentId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(testPaymentId);
      expect(res.body.data.status).toBe('SUCCEEDED');
    });
  });

  // ===========================================================================
  // 7. Review Moderation
  // ===========================================================================

  describe('Review Moderation', () => {
    it('should moderate review publication status', async () => {
      // Unpublish review
      const resUnpub = await request(server)
        .patch(`/api/v1/admin/reviews/${testReviewId}/moderation`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isPublished: false, moderationReason: 'Review under inspection' });

      expect(resUnpub.status).toBe(200);
      expect(resUnpub.body.data.isPublished).toBe(false);

      // Verify in review detail
      const resGet = await request(server)
        .get(`/api/v1/admin/reviews/${testReviewId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(resGet.status).toBe(200);
      expect(resGet.body.data.isPublished).toBe(false);

      // Republish review
      const resPub = await request(server)
        .patch(`/api/v1/admin/reviews/${testReviewId}/moderation`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isPublished: true, moderationReason: 'Approved after verification' });

      expect(resPub.status).toBe(200);
      expect(resPub.body.data.isPublished).toBe(true);
    });
  });

  // ===========================================================================
  // 8. Notification Administration
  // ===========================================================================

  describe('Notification Administration', () => {
    it('should inspect system notifications platform-wide', async () => {
      const res = await request(server)
        .get('/api/v1/admin/notifications?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items).toBeDefined();
    });
  });
});
