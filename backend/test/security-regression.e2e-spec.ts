import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { GlobalExceptionFilter, TransformInterceptor } from '../src/common';
import { UserRole, UserStatus } from '../src/modules/auth/types/user-role.enum';

describe('Security & Authorization Regression (e2e)', () => {
  let app: INestApplication;
  let server: App;
  let prisma: PrismaService;

  let customer1Token: string;
  let customer2Token: string;
  let manager1Token: string;
  let manager2Token: string;
  let adminToken: string;
  let adminUserId: string;

  const testIds = {
    customer1Id: '80000000-0000-4000-8000-000000000101',
    customer2Id: '80000000-0000-4000-8000-000000000102',
    suspendedCustomerId: '80000000-0000-4000-8000-000000000103',
    manager1Id: '80000000-0000-4000-8000-000000000201',
    manager2Id: '80000000-0000-4000-8000-000000000202',
    hotel1Id: '80000000-0000-4000-8000-000000000001',
    hotel2Id: '80000000-0000-4000-8000-000000000002',
    roomTypeId1: '80000000-0000-4000-8000-000000000011',
    roomTypeId2: '80000000-0000-4000-8000-000000000012',
    roomId1: '80000000-0000-4000-8000-000000000021',
    roomId2: '80000000-0000-4000-8000-000000000022',
  };

  let customer2BookingId: string;
  let customer2PaymentId: string;
  let customer2ReviewId: string;
  let customer2NotificationId: string;

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
        transformOptions: { enableImplicitConversion: true },
      }),
    );

    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor());

    await app.init();
    server = app.getHttpServer() as App;
    prisma = app.get<PrismaService>(PrismaService);

    const passwordHash = await bcrypt.hash('Password123!', 10);

    // 1. Setup Users
    await prisma.user.upsert({
      where: { id: testIds.customer1Id },
      update: { status: UserStatus.ACTIVE },
      create: {
        id: testIds.customer1Id,
        email: 'sec.cust1@stayora.com',
        passwordHash,
        firstName: 'Alice',
        lastName: 'Customer',
        role: UserRole.CUSTOMER,
        status: UserStatus.ACTIVE,
      },
    });

    await prisma.user.upsert({
      where: { id: testIds.customer2Id },
      update: { status: UserStatus.ACTIVE },
      create: {
        id: testIds.customer2Id,
        email: 'sec.cust2@stayora.com',
        passwordHash,
        firstName: 'Bob',
        lastName: 'Customer',
        role: UserRole.CUSTOMER,
        status: UserStatus.ACTIVE,
      },
    });

    await prisma.user.upsert({
      where: { id: testIds.suspendedCustomerId },
      update: { status: UserStatus.SUSPENDED },
      create: {
        id: testIds.suspendedCustomerId,
        email: 'sec.suspended@stayora.com',
        passwordHash,
        firstName: 'Suspended',
        lastName: 'User',
        role: UserRole.CUSTOMER,
        status: UserStatus.SUSPENDED,
      },
    });

    await prisma.user.upsert({
      where: { id: testIds.manager1Id },
      update: { status: UserStatus.ACTIVE },
      create: {
        id: testIds.manager1Id,
        email: 'sec.mgr1@stayora.com',
        passwordHash,
        firstName: 'Manager',
        lastName: 'One',
        role: UserRole.HOTEL_MANAGER,
        status: UserStatus.ACTIVE,
      },
    });

    await prisma.user.upsert({
      where: { id: testIds.manager2Id },
      update: { status: UserStatus.ACTIVE },
      create: {
        id: testIds.manager2Id,
        email: 'sec.mgr2@stayora.com',
        passwordHash,
        firstName: 'Manager',
        lastName: 'Two',
        role: UserRole.HOTEL_MANAGER,
        status: UserStatus.ACTIVE,
      },
    });

    // Login Users
    const resC1 = await request(server)
      .post('/api/v1/auth/customer/login')
      .send({ email: 'sec.cust1@stayora.com', password: 'Password123!' });
    customer1Token = resC1.body.data.accessToken;

    const resC2 = await request(server)
      .post('/api/v1/auth/customer/login')
      .send({ email: 'sec.cust2@stayora.com', password: 'Password123!' });
    customer2Token = resC2.body.data.accessToken;

    const resM1 = await request(server)
      .post('/api/v1/auth/manager/login')
      .send({ email: 'sec.mgr1@stayora.com', password: 'Password123!' });
    manager1Token = resM1.body.data.accessToken;

    const resM2 = await request(server)
      .post('/api/v1/auth/manager/login')
      .send({ email: 'sec.mgr2@stayora.com', password: 'Password123!' });
    manager2Token = resM2.body.data.accessToken;

    const resAdmin = await request(server)
      .post('/api/v1/auth/admin/login')
      .send({ email: 'admin@stayora.com', password: 'Password123!' });
    adminToken = resAdmin.body.data.accessToken;
    adminUserId = resAdmin.body.data.user.id;

    // 2. Setup Hotel 1 (Managed by Manager 1)
    await prisma.hotel.upsert({
      where: { id: testIds.hotel1Id },
      update: { isActive: true },
      create: {
        id: testIds.hotel1Id,
        name: 'Security Test Hotel 1',
        slug: 'security-test-hotel-1',
        description: 'Hotel managed by Manager 1',
        starRating: 4,
        addressLine1: '101 Security Way',
        city: 'Mumbai',
        state: 'Maharashtra',
        country: 'India',
        postalCode: '400001',
        phone: '+919999998801',
        email: 'hotel1@security.com',
        isActive: true,
      },
    });

    await prisma.hotelManager.upsert({
      where: {
        userId_hotelId: {
          userId: testIds.manager1Id,
          hotelId: testIds.hotel1Id,
        },
      },
      update: {},
      create: {
        userId: testIds.manager1Id,
        hotelId: testIds.hotel1Id,
        isPrimary: true,
      },
    });

    // 3. Setup Hotel 2 (Managed by Manager 2)
    await prisma.hotel.upsert({
      where: { id: testIds.hotel2Id },
      update: { isActive: true },
      create: {
        id: testIds.hotel2Id,
        name: 'Security Test Hotel 2',
        slug: 'security-test-hotel-2',
        description: 'Hotel managed by Manager 2',
        starRating: 5,
        addressLine1: '202 Security Way',
        city: 'Goa',
        state: 'Goa',
        country: 'India',
        postalCode: '403001',
        phone: '+919999998802',
        email: 'hotel2@security.com',
        isActive: true,
      },
    });

    await prisma.hotelManager.upsert({
      where: {
        userId_hotelId: {
          userId: testIds.manager2Id,
          hotelId: testIds.hotel2Id,
        },
      },
      update: {},
      create: {
        userId: testIds.manager2Id,
        hotelId: testIds.hotel2Id,
        isPrimary: true,
      },
    });

    // Setup RoomTypes & Rooms for Hotel 1
    await prisma.roomType.upsert({
      where: { id: testIds.roomTypeId1 },
      update: { isActive: true },
      create: {
        id: testIds.roomTypeId1,
        hotelId: testIds.hotel1Id,
        name: 'H1 Deluxe Suite',
        slug: 'h1-deluxe-suite',
        description: 'Deluxe in Hotel 1',
        maxOccupancy: 2,
        maxAdults: 2,
        maxChildren: 1,
        basePriceCents: BigInt(700000),
        currency: 'INR',
        bedType: 'KING',
        isActive: true,
      },
    });

    await prisma.room.upsert({
      where: { id: testIds.roomId1 },
      update: { operationalStatus: 'AVAILABLE' },
      create: {
        id: testIds.roomId1,
        hotelId: testIds.hotel1Id,
        roomTypeId: testIds.roomTypeId1,
        roomNumber: 'SEC-101',
        floor: 1,
        operationalStatus: 'AVAILABLE',
      },
    });

    // Setup RoomTypes & Rooms for Hotel 2
    await prisma.roomType.upsert({
      where: { id: testIds.roomTypeId2 },
      update: { isActive: true },
      create: {
        id: testIds.roomTypeId2,
        hotelId: testIds.hotel2Id,
        name: 'H2 Ocean Villa',
        slug: 'h2-ocean-villa',
        description: 'Villa in Hotel 2',
        maxOccupancy: 3,
        maxAdults: 3,
        maxChildren: 1,
        basePriceCents: BigInt(1200000),
        currency: 'INR',
        bedType: 'KING',
        isActive: true,
      },
    });

    await prisma.room.upsert({
      where: { id: testIds.roomId2 },
      update: { operationalStatus: 'AVAILABLE' },
      create: {
        id: testIds.roomId2,
        hotelId: testIds.hotel2Id,
        roomTypeId: testIds.roomTypeId2,
        roomNumber: 'SEC-201',
        floor: 1,
        operationalStatus: 'AVAILABLE',
      },
    });

    // 4. Create Customer 2 Resources to be tested for IDOR attacks
    const resB = await request(server)
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${customer2Token}`)
      .send({
        hotelId: testIds.hotel1Id,
        roomTypeId: testIds.roomTypeId1,
        checkIn: '2026-11-20',
        checkOut: '2026-11-22',
        guests: 2,
        rooms: 1,
      });
    customer2BookingId = resB.body.data.id;

    const resPay = await request(server)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${customer2Token}`)
      .set('Idempotency-Key', `sec-pay-${Date.now()}`)
      .send({
        bookingId: customer2BookingId,
        paymentMethod: 'CREDIT_CARD',
      });
    customer2PaymentId = resPay.body.data.id;

    // Create Notification for Customer 2
    const notification = await prisma.notification.create({
      data: {
        userId: testIds.customer2Id,
        type: 'SYSTEM',
        title: 'Customer 2 Secret Notification',
        message: 'Confidential message for Bob only',
      },
    });
    customer2NotificationId = notification.id;

    // Create a checked-out booking + review for Customer 2
    const resReviewBooking = await request(server)
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${customer2Token}`)
      .send({
        hotelId: testIds.hotel1Id,
        roomTypeId: testIds.roomTypeId1,
        checkIn: '2026-11-25',
        checkOut: '2026-11-27',
        guests: 1,
        rooms: 1,
      });
    const reviewBookingId = resReviewBooking.body.data.id;

    await prisma.booking.update({
      where: { id: reviewBookingId },
      data: {
        status: 'CHECKED_OUT',
        checkedInAt: new Date('2026-11-25T14:00:00Z'),
        checkedOutAt: new Date('2026-11-27T11:00:00Z'),
      },
    });

    const resRev = await request(server)
      .post('/api/v1/reviews')
      .set('Authorization', `Bearer ${customer2Token}`)
      .send({
        bookingId: reviewBookingId,
        rating: 5,
        title: 'Bob Great Review',
        comment: 'Excellent stay by Bob.',
      });
    customer2ReviewId = resRev.body.data.id;
  });

  afterAll(async () => {
    // Cleanup reviews
    await prisma.review.deleteMany({
      where: { customerId: { in: [testIds.customer1Id, testIds.customer2Id] } },
    });
    // Cleanup notifications
    await prisma.notification.deleteMany({
      where: { userId: { in: [testIds.customer1Id, testIds.customer2Id] } },
    });
    // Cleanup payments & bookings
    await prisma.paymentAttempt.deleteMany({
      where: { booking: { customerId: { in: [testIds.customer1Id, testIds.customer2Id] } } },
    });
    await prisma.payment.deleteMany({
      where: { booking: { customerId: { in: [testIds.customer1Id, testIds.customer2Id] } } },
    });
    await prisma.bookingRoom.deleteMany({
      where: { booking: { customerId: { in: [testIds.customer1Id, testIds.customer2Id] } } },
    });
    await prisma.bookingPriceSnapshot.deleteMany({
      where: { booking: { customerId: { in: [testIds.customer1Id, testIds.customer2Id] } } },
    });
    await prisma.bookingGuest.deleteMany({
      where: { booking: { customerId: { in: [testIds.customer1Id, testIds.customer2Id] } } },
    });
    await prisma.booking.deleteMany({
      where: { customerId: { in: [testIds.customer1Id, testIds.customer2Id] } },
    });

    // Cleanup inventory, managers, hotels
    await prisma.room.deleteMany({ where: { hotelId: { in: [testIds.hotel1Id, testIds.hotel2Id] } } });
    await prisma.roomType.deleteMany({ where: { hotelId: { in: [testIds.hotel1Id, testIds.hotel2Id] } } });
    await prisma.hotelManager.deleteMany({ where: { hotelId: { in: [testIds.hotel1Id, testIds.hotel2Id] } } });
    await prisma.hotel.deleteMany({ where: { id: { in: [testIds.hotel1Id, testIds.hotel2Id] } } });

    // Cleanup users
    await prisma.user.deleteMany({
      where: {
        id: {
          in: [
            testIds.customer1Id,
            testIds.customer2Id,
            testIds.suspendedCustomerId,
            testIds.manager1Id,
            testIds.manager2Id,
          ],
        },
      },
    });

    await app.close();
  });

  // ===========================================================================
  // 1. Horizontal Privilege Escalation & IDOR Defense (Customer vs Customer)
  // ===========================================================================
  describe('Customer IDOR & Horizontal Privilege Escalation Defense', () => {
    it('Customer 1 should be DENIED reading Customer 2 booking details (404 IDOR Defense)', async () => {
      const res = await request(server)
        .get(`/api/v1/bookings/${customer2BookingId}`)
        .set('Authorization', `Bearer ${customer1Token}`)
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BOOKING_NOT_FOUND');
    });

    it('Customer 1 should be DENIED cancelling Customer 2 booking (404 IDOR Defense)', async () => {
      const res = await request(server)
        .post(`/api/v1/bookings/${customer2BookingId}/cancel`)
        .set('Authorization', `Bearer ${customer1Token}`)
        .send({ reason: 'Malicious cancellation by another user' })
        .expect(404);

      expect(res.body.success).toBe(false);
    });

    it('Customer 1 should be DENIED inspecting Customer 2 payment details (403/404 Forbidden)', async () => {
      const res = await request(server)
        .get(`/api/v1/payments/${customer2PaymentId}`)
        .set('Authorization', `Bearer ${customer1Token}`);

      expect([403, 404]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });

    it('Customer 1 should be DENIED reading Customer 2 notification (404 IDOR Defense)', async () => {
      const res = await request(server)
        .get(`/api/v1/notifications/${customer2NotificationId}`)
        .set('Authorization', `Bearer ${customer1Token}`)
        .expect(404);

      expect(res.body.success).toBe(false);
    });

    it('Customer 1 should be DENIED marking Customer 2 notification as read (404 IDOR Defense)', async () => {
      const res = await request(server)
        .patch(`/api/v1/notifications/${customer2NotificationId}/read`)
        .set('Authorization', `Bearer ${customer1Token}`)
        .expect(404);

      expect(res.body.success).toBe(false);
    });

    it('Customer 1 should be DENIED modifying Customer 2 review (403/404 Forbidden)', async () => {
      const res = await request(server)
        .patch(`/api/v1/reviews/${customer2ReviewId}`)
        .set('Authorization', `Bearer ${customer1Token}`)
        .send({ rating: 1, title: 'Tampered review' });

      expect([403, 404]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });

    it('Customer 1 should be DENIED deleting Customer 2 review (403/404 Forbidden)', async () => {
      const res = await request(server)
        .delete(`/api/v1/reviews/${customer2ReviewId}`)
        .set('Authorization', `Bearer ${customer1Token}`);

      expect([403, 404]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });
  });

  // ===========================================================================
  // 2. Manager Tenant Isolation (Manager A vs Hotel B)
  // ===========================================================================
  describe('Manager Tenant Boundary & Resource Authorization', () => {
    it('Manager 1 should be FORBIDDEN from reading unassigned Hotel 2 (403 Forbidden)', async () => {
      const res = await request(server)
        .get(`/api/v1/manager/hotels/${testIds.hotel2Id}`)
        .set('Authorization', `Bearer ${manager1Token}`)
        .expect(403);

      expect(res.body.success).toBe(false);
    });

    it('Manager 1 should be FORBIDDEN from updating unassigned Hotel 2 (403 Forbidden)', async () => {
      const res = await request(server)
        .patch(`/api/v1/manager/hotels/${testIds.hotel2Id}`)
        .set('Authorization', `Bearer ${manager1Token}`)
        .send({ description: 'Tampered by unassigned manager' })
        .expect(403);

      expect(res.body.success).toBe(false);
    });

    it('Manager 1 should be FORBIDDEN from deactivating unassigned Hotel 2 (403 Forbidden)', async () => {
      const res = await request(server)
        .delete(`/api/v1/manager/hotels/${testIds.hotel2Id}`)
        .set('Authorization', `Bearer ${manager1Token}`)
        .expect(403);

      expect(res.body.success).toBe(false);
    });

    it('Manager 1 should be FORBIDDEN from creating a RoomType in unassigned Hotel 2 (403 Forbidden)', async () => {
      const res = await request(server)
        .post('/api/v1/room-types')
        .set('Authorization', `Bearer ${manager1Token}`)
        .send({
          hotelId: testIds.hotel2Id,
          name: 'Unauthorized Suite',
          slug: 'unauthorized-suite',
          description: 'Created by unauthorized manager',
          maxOccupancy: 2,
          maxAdults: 2,
          maxChildren: 1,
          basePriceCents: 500000,
          currency: 'INR',
          bedType: 'KING',
        })
        .expect(403);

      expect(res.body.success).toBe(false);
    });
  });

  // ===========================================================================
  // 3. Vertical Privilege Escalation (Customer / Manager -> Admin)
  // ===========================================================================
  describe('Vertical Privilege Escalation Defense', () => {
    it('Customer should be FORBIDDEN from accessing Admin Dashboard (403 Forbidden)', async () => {
      const res = await request(server)
        .get('/api/v1/admin/dashboard')
        .set('Authorization', `Bearer ${customer1Token}`)
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('Customer should be FORBIDDEN from accessing Admin Users List (403 Forbidden)', async () => {
      const res = await request(server)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${customer1Token}`)
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('Customer should be FORBIDDEN from accessing Platform Audit Logs (403 Forbidden)', async () => {
      const res = await request(server)
        .get('/api/v1/admin/audit-logs')
        .set('Authorization', `Bearer ${customer1Token}`)
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('Manager should be FORBIDDEN from accessing Admin Dashboard (403 Forbidden)', async () => {
      const res = await request(server)
        .get('/api/v1/admin/dashboard')
        .set('Authorization', `Bearer ${manager1Token}`)
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('Customer should be FORBIDDEN from accessing Manager Portal (403 Forbidden)', async () => {
      const res = await request(server)
        .get('/api/v1/manager/hotels')
        .set('Authorization', `Bearer ${customer1Token}`)
        .expect(403);

      expect(res.body.success).toBe(false);
    });
  });

  // ===========================================================================
  // 4. Token Tampering, Corrupted Credentials & Account Status
  // ===========================================================================
  describe('Token Security & Account Status Enforcement', () => {
    it('should reject requests with completely missing Authorization header with 401', async () => {
      const res = await request(server).get('/api/v1/auth/me').expect(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject malformed JWT tokens with 401 UNAUTHORIZED or INVALID_TOKEN', async () => {
      const res = await request(server)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer totally.corrupted.jwt.token')
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(['INVALID_TOKEN', 'UNAUTHORIZED']).toContain(res.body.error.code);
    });

    it('should reject tampered JWT signatures with 401 UNAUTHORIZED or INVALID_TOKEN', async () => {
      // Modify the signature portion of a valid token
      const parts = customer1Token.split('.');
      const tamperedToken = `${parts[0]}.${parts[1]}.tamperedSignature12345`;

      const res = await request(server)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${tamperedToken}`)
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(['INVALID_TOKEN', 'UNAUTHORIZED']).toContain(res.body.error.code);
    });

    it('should reject login for a SUSPENDED user with 403 Forbidden', async () => {
      const res = await request(server)
        .post('/api/v1/auth/customer/login')
        .send({ email: 'sec.suspended@stayora.com', password: 'Password123!' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  // ===========================================================================
  // 5. Admin Self-Protection Invariant
  // ===========================================================================
  describe('Admin Self-Protection Invariant', () => {
    it('Admin should be BLOCKED with 403 when attempting to suspend or disable their own account', async () => {
      const res = await request(server)
        .patch(`/api/v1/admin/users/${adminUserId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: UserStatus.SUSPENDED, reason: 'Accidental lockout attempt' })
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('ADMIN_SELF_PROTECTION');

      // Verify in database that admin remains ACTIVE
      const adminDb = await prisma.user.findUnique({ where: { id: adminUserId } });
      expect(adminDb?.status).toBe(UserStatus.ACTIVE);
    });
  });

  // ===========================================================================
  // 6. Mass Assignment & Parameter Injection Defense
  // ===========================================================================
  describe('Mass Assignment & Parameter Injection Defense', () => {
    it('should reject non-whitelisted fields in registration DTO with 400 VALIDATION_ERROR', async () => {
      const res = await request(server)
        .post('/api/v1/auth/customer/register')
        .send({
          email: `sec-inj-${Date.now()}@stayora.com`,
          password: 'Password123!',
          firstName: 'Injected',
          lastName: 'User',
          role: 'ADMIN', // malicious role elevation attempt
          status: 'ACTIVE',
          isAdmin: true,
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('Booking creation must compute authoritative amount server-side regardless of client input', async () => {
      // Client tries to inject totalAmount: "1.00" and totalAmountCents: "100"
      const res = await request(server)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${customer1Token}`)
        .send({
          hotelId: testIds.hotel1Id,
          roomTypeId: testIds.roomTypeId1,
          checkIn: '2026-12-28',
          checkOut: '2026-12-30', // 2 nights @ 7000 INR = 14000 INR
          guests: 2,
          rooms: 1,
          totalAmount: '1.00', // Tampered client amount
          totalAmountCents: '100', // Tampered client amount
        });

      // Request either rejects non-whitelisted totalAmount with 400 OR ignores it and calculates 14000.00
      if (res.status === 201) {
        expect(res.body.data.totalAmount).toBe('14000.00');
        expect(res.body.data.totalAmountCents).toBe('1400000');
        await prisma.booking.delete({ where: { id: res.body.data.id } });
      } else {
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
      }
    });
  });
});
