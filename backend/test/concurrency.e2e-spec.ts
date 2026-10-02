import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { GlobalExceptionFilter, TransformInterceptor } from '../src/common';
import { UserRole, UserStatus } from '../src/modules/auth/types/user-role.enum';
import { BookingStatus } from '../src/modules/bookings/types/booking-status.enum';

describe('Concurrency & Race Condition Reliability (e2e)', () => {
  let app: INestApplication;
  let server: App;
  let prisma: PrismaService;

  let customer1Token: string;
  let customer2Token: string;
  let customer3Token: string;

  const testIds = {
    hotelId: '90000000-0000-4000-8000-000000000001',
    roomTypeId2Rooms: '90000000-0000-4000-8000-000000000002',
    roomTypeId1Room: '90000000-0000-4000-8000-000000000003',
    roomId1: '90000000-0000-4000-8000-000000000011',
    roomId2: '90000000-0000-4000-8000-000000000012',
    roomIdBoundary: '90000000-0000-4000-8000-000000000013',
    customer1Id: '90000000-0000-4000-8000-000000000101',
    customer2Id: '90000000-0000-4000-8000-000000000102',
    customer3Id: '90000000-0000-4000-8000-000000000103',
  };

  const trackedBookings: string[] = [];

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

    // 1. Create Test Customers
    for (const [idx, id, email] of [
      [1, testIds.customer1Id, 'conc.cust1@stayora.com'],
      [2, testIds.customer2Id, 'conc.cust2@stayora.com'],
      [3, testIds.customer3Id, 'conc.cust3@stayora.com'],
    ] as const) {
      await prisma.user.upsert({
        where: { id },
        update: { status: UserStatus.ACTIVE },
        create: {
          id,
          email,
          passwordHash,
          firstName: `ConcCustomer${idx}`,
          lastName: 'Tester',
          role: UserRole.CUSTOMER,
          status: UserStatus.ACTIVE,
        },
      });
    }

    // Login Customers
    const resLogin1 = await request(server)
      .post('/api/v1/auth/customer/login')
      .send({ email: 'conc.cust1@stayora.com', password: 'Password123!' });
    customer1Token = resLogin1.body.data.accessToken;

    const resLogin2 = await request(server)
      .post('/api/v1/auth/customer/login')
      .send({ email: 'conc.cust2@stayora.com', password: 'Password123!' });
    customer2Token = resLogin2.body.data.accessToken;

    const resLogin3 = await request(server)
      .post('/api/v1/auth/customer/login')
      .send({ email: 'conc.cust3@stayora.com', password: 'Password123!' });
    customer3Token = resLogin3.body.data.accessToken;

    // 2. Create Test Hotel
    await prisma.hotel.upsert({
      where: { id: testIds.hotelId },
      update: { isActive: true },
      create: {
        id: testIds.hotelId,
        name: 'Concurrency Test Hotel',
        slug: 'concurrency-test-hotel',
        description: 'Hotel for race-condition testing',
        starRating: 4,
        addressLine1: '100 Race Condition Blvd',
        city: 'Mumbai',
        state: 'Maharashtra',
        country: 'India',
        postalCode: '400001',
        phone: '+919999999901',
        email: 'concurrency.hotel@stayora.com',
        isActive: true,
      },
    });

    // 3. Create Room Type with 2 physical rooms
    await prisma.roomType.upsert({
      where: { id: testIds.roomTypeId2Rooms },
      update: { isActive: true },
      create: {
        id: testIds.roomTypeId2Rooms,
        hotelId: testIds.hotelId,
        name: 'Two Room Category',
        slug: 'two-room-category',
        description: 'Category containing exactly 2 physical units',
        maxOccupancy: 2,
        maxAdults: 2,
        maxChildren: 1,
        basePriceCents: BigInt(500000), // 5000 INR
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
        hotelId: testIds.hotelId,
        roomTypeId: testIds.roomTypeId2Rooms,
        roomNumber: 'CONC-201',
        floor: 2,
        operationalStatus: 'AVAILABLE',
      },
    });

    await prisma.room.upsert({
      where: { id: testIds.roomId2 },
      update: { operationalStatus: 'AVAILABLE' },
      create: {
        id: testIds.roomId2,
        hotelId: testIds.hotelId,
        roomTypeId: testIds.roomTypeId2Rooms,
        roomNumber: 'CONC-202',
        floor: 2,
        operationalStatus: 'AVAILABLE',
      },
    });

    // 4. Create Room Type with 1 physical room for boundary test
    await prisma.roomType.upsert({
      where: { id: testIds.roomTypeId1Room },
      update: { isActive: true },
      create: {
        id: testIds.roomTypeId1Room,
        hotelId: testIds.hotelId,
        name: 'One Room Boundary Category',
        slug: 'one-room-boundary-category',
        description: 'Category containing exactly 1 physical unit',
        maxOccupancy: 2,
        maxAdults: 2,
        maxChildren: 1,
        basePriceCents: BigInt(600000),
        currency: 'INR',
        bedType: 'QUEEN',
        isActive: true,
      },
    });

    await prisma.room.upsert({
      where: { id: testIds.roomIdBoundary },
      update: { operationalStatus: 'AVAILABLE' },
      create: {
        id: testIds.roomIdBoundary,
        hotelId: testIds.hotelId,
        roomTypeId: testIds.roomTypeId1Room,
        roomNumber: 'CONC-301',
        floor: 3,
        operationalStatus: 'AVAILABLE',
      },
    });
  });

  afterAll(async () => {
    // Clean up created bookings
    if (trackedBookings.length > 0) {
      await prisma.review.deleteMany({ where: { bookingId: { in: trackedBookings } } });
      await prisma.paymentAttempt.deleteMany({ where: { bookingId: { in: trackedBookings } } });
      await prisma.payment.deleteMany({ where: { bookingId: { in: trackedBookings } } });
      await prisma.bookingRoom.deleteMany({ where: { bookingId: { in: trackedBookings } } });
      await prisma.bookingPriceSnapshot.deleteMany({ where: { bookingId: { in: trackedBookings } } });
      await prisma.bookingGuest.deleteMany({ where: { bookingId: { in: trackedBookings } } });
      await prisma.booking.deleteMany({ where: { id: { in: trackedBookings } } });
    }

    // Clean up test inventory and hotel
    await prisma.room.deleteMany({ where: { hotelId: testIds.hotelId } });
    await prisma.roomType.deleteMany({ where: { hotelId: testIds.hotelId } });
    await prisma.hotel.deleteMany({ where: { id: testIds.hotelId } });

    // Clean up test users
    await prisma.user.deleteMany({
      where: {
        id: {
          in: [testIds.customer1Id, testIds.customer2Id, testIds.customer3Id],
        },
      },
    });

    await app.close();
  });

  // ===========================================================================
  // 1. Multi-Room Booking Concurrency (2 Rooms vs 3 Concurrent Requests)
  // ===========================================================================
  describe('Multi-Room Booking Concurrency (2 rooms, 3 concurrent requests)', () => {
    it('should allocate exactly 2 rooms to 2 requests and reject the 3rd with ROOM_NOT_AVAILABLE', async () => {
      const checkIn = '2026-11-01';
      const checkOut = '2026-11-05';

      const payload = {
        hotelId: testIds.hotelId,
        roomTypeId: testIds.roomTypeId2Rooms,
        checkIn,
        checkOut,
        guests: 2,
        rooms: 1,
      };

      // Launch 3 simultaneous requests for 2 available rooms
      const [res1, res2, res3] = await Promise.all([
        request(server)
          .post('/api/v1/bookings')
          .set('Authorization', `Bearer ${customer1Token}`)
          .send(payload),
        request(server)
          .post('/api/v1/bookings')
          .set('Authorization', `Bearer ${customer2Token}`)
          .send(payload),
        request(server)
          .post('/api/v1/bookings')
          .set('Authorization', `Bearer ${customer3Token}`)
          .send(payload),
      ]);

      const responses = [res1, res2, res3];
      const successResponses = responses.filter((r) => r.status === 201);
      const conflictResponses = responses.filter((r) => r.status === 409);

      // Invariant: Exactly 2 successes, exactly 1 conflict
      expect(successResponses.length).toBe(2);
      expect(conflictResponses.length).toBe(1);

      // Verify conflict response code
      expect(conflictResponses[0].body.success).toBe(false);
      expect(conflictResponses[0].body.error.code).toBe('ROOM_NOT_AVAILABLE');

      // Track successful bookings for teardown
      for (const s of successResponses) {
        trackedBookings.push(s.body.data.id);
      }

      // Invariant: Database must have allocated distinct physical rooms
      const allocatedRoomIds = new Set<string>();
      for (const s of successResponses) {
        const bookingId = s.body.data.id;
        const br = await prisma.bookingRoom.findMany({ where: { bookingId } });
        expect(br.length).toBe(1);
        allocatedRoomIds.add(br[0].roomId);
      }

      expect(allocatedRoomIds.size).toBe(2);
      expect(allocatedRoomIds.has(testIds.roomId1)).toBe(true);
      expect(allocatedRoomIds.has(testIds.roomId2)).toBe(true);
    });
  });

  // ===========================================================================
  // 2. Non-Overlapping Boundary Date Concurrency ([checkIn, checkOut) Invariant)
  // ===========================================================================
  describe('Boundary Date Concurrency on 1 Physical Room', () => {
    it('should allow two concurrent requests for [10, 15) and [15, 20) on the same physical room', async () => {
      // Range A: Nov 10 to Nov 15 (checkout on morning of Nov 15)
      // Range B: Nov 15 to Nov 20 (checkin on afternoon of Nov 15)
      // These do NOT overlap because intervals are [checkIn, checkOut)
      const payloadA = {
        hotelId: testIds.hotelId,
        roomTypeId: testIds.roomTypeId1Room,
        checkIn: '2026-11-10',
        checkOut: '2026-11-15',
        guests: 1,
        rooms: 1,
      };

      const payloadB = {
        hotelId: testIds.hotelId,
        roomTypeId: testIds.roomTypeId1Room,
        checkIn: '2026-11-15',
        checkOut: '2026-11-20',
        guests: 1,
        rooms: 1,
      };

      const [resA, resB] = await Promise.all([
        request(server)
          .post('/api/v1/bookings')
          .set('Authorization', `Bearer ${customer1Token}`)
          .send(payloadA),
        request(server)
          .post('/api/v1/bookings')
          .set('Authorization', `Bearer ${customer2Token}`)
          .send(payloadB),
      ]);

      // BOTH requests must succeed because boundary dates do not conflict!
      expect(resA.status).toBe(201);
      expect(resB.status).toBe(201);

      trackedBookings.push(resA.body.data.id);
      trackedBookings.push(resB.body.data.id);

      // Verify both bookings allocated the SAME physical room without conflict
      const allocationA = await prisma.bookingRoom.findFirst({
        where: { bookingId: resA.body.data.id },
      });
      const allocationB = await prisma.bookingRoom.findFirst({
        where: { bookingId: resB.body.data.id },
      });

      expect(allocationA?.roomId).toBe(testIds.roomIdBoundary);
      expect(allocationB?.roomId).toBe(testIds.roomIdBoundary);
    });
  });

  // ===========================================================================
  // 3. Payment Idempotency Concurrency Race
  // ===========================================================================
  describe('Payment Idempotency Concurrency Race', () => {
    let paymentBookingId: string;

    beforeAll(async () => {
      // Create a dedicated booking for payment concurrency test
      const res = await request(server)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${customer1Token}`)
        .send({
          hotelId: testIds.hotelId,
          roomTypeId: testIds.roomTypeId2Rooms,
          checkIn: '2026-12-01',
          checkOut: '2026-12-03',
          guests: 2,
          rooms: 1,
        });

      paymentBookingId = res.body.data.id;
      trackedBookings.push(paymentBookingId);
    });

    it('should handle 3 concurrent payment requests with the SAME Idempotency-Key as exactly one logical operation', async () => {
      const idempotencyKey = `conc-idem-${Date.now()}`;
      const payload = {
        bookingId: paymentBookingId,
        paymentMethod: 'CREDIT_CARD',
      };

      // 3 concurrent requests with the identical idempotency key
      const [res1, res2, res3] = await Promise.all([
        request(server)
          .post('/api/v1/payments')
          .set('Authorization', `Bearer ${customer1Token}`)
          .set('Idempotency-Key', idempotencyKey)
          .send(payload),
        request(server)
          .post('/api/v1/payments')
          .set('Authorization', `Bearer ${customer1Token}`)
          .set('Idempotency-Key', idempotencyKey)
          .send(payload),
        request(server)
          .post('/api/v1/payments')
          .set('Authorization', `Bearer ${customer1Token}`)
          .set('Idempotency-Key', idempotencyKey)
          .send(payload),
      ]);

      const responses = [res1, res2, res3];

      // All calls must succeed (either 201 Created or 200/201 idempotent replay)
      for (const r of responses) {
        expect([200, 201]).toContain(r.status);
        expect(r.body.success).toBe(true);
      }

      // Transaction references must be IDENTICAL across all 3 responses
      const ref1 = res1.body.data.transactionReference;
      const ref2 = res2.body.data.transactionReference;
      const ref3 = res3.body.data.transactionReference;

      expect(ref1).toBeDefined();
      expect(ref2).toBe(ref1);
      expect(ref3).toBe(ref1);

      // Invariant: Exactly ONE Payment record and ONE PaymentAttempt record in PostgreSQL
      const paymentRecords = await prisma.payment.findMany({
        where: { bookingId: paymentBookingId },
      });
      expect(paymentRecords.length).toBe(1);

      const attempts = await prisma.paymentAttempt.findMany({
        where: { bookingId: paymentBookingId },
      });
      expect(attempts.length).toBe(1);

      // Invariant: Booking must be in CONFIRMED state
      const dbBooking = await prisma.booking.findUnique({
        where: { id: paymentBookingId },
      });
      expect(dbBooking?.status).toBe(BookingStatus.CONFIRMED);
    });

    it('should reject reused Idempotency-Key across a different booking with 409 IDEMPOTENCY_CONFLICT', async () => {
      // Create a second booking
      const resBooking2 = await request(server)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${customer1Token}`)
        .send({
          hotelId: testIds.hotelId,
          roomTypeId: testIds.roomTypeId2Rooms,
          checkIn: '2026-12-05',
          checkOut: '2026-12-07',
          guests: 2,
          rooms: 1,
        });

      const booking2Id = resBooking2.body.data.id;
      trackedBookings.push(booking2Id);

      // Use a fixed key on booking 1
      const reusedKey = `shared-key-${Date.now()}`;
      const resPay1 = await request(server)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${customer1Token}`)
        .set('Idempotency-Key', reusedKey)
        .send({ bookingId: booking2Id, paymentMethod: 'CREDIT_CARD' });
      expect([200, 201]).toContain(resPay1.status);

      // Create a third booking and attempt reusing the same key
      const resBooking3 = await request(server)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${customer1Token}`)
        .send({
          hotelId: testIds.hotelId,
          roomTypeId: testIds.roomTypeId2Rooms,
          checkIn: '2026-12-10',
          checkOut: '2026-12-12',
          guests: 2,
          rooms: 1,
        });
      const booking3Id = resBooking3.body.data.id;
      trackedBookings.push(booking3Id);

      const resReused = await request(server)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${customer1Token}`)
        .set('Idempotency-Key', reusedKey)
        .send({ bookingId: booking3Id, paymentMethod: 'CREDIT_CARD' });

      expect(resReused.status).toBe(409);
      expect(resReused.body.success).toBe(false);
      expect(['IDEMPOTENCY_KEY_REUSED', 'IDEMPOTENCY_CONFLICT']).toContain(
        resReused.body.error.code,
      );
    });
  });

  // ===========================================================================
  // 4. Concurrent Duplicate Review Defense
  // ===========================================================================
  describe('Concurrent Duplicate Review Defense', () => {
    let reviewBookingId: string;

    beforeAll(async () => {
      // Create with valid future dates, then update to CHECKED_OUT
      const resB = await request(server)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${customer1Token}`)
        .send({
          hotelId: testIds.hotelId,
          roomTypeId: testIds.roomTypeId2Rooms,
          checkIn: '2026-12-15',
          checkOut: '2026-12-18',
          guests: 1,
          rooms: 1,
        });

      expect(resB.status).toBe(201);
      reviewBookingId = resB.body.data.id;
      trackedBookings.push(reviewBookingId);

      // Force status to CHECKED_OUT in database
      await prisma.booking.update({
        where: { id: reviewBookingId },
        data: {
          status: 'CHECKED_OUT',
          checkedInAt: new Date('2026-12-15T14:00:00Z'),
          checkedOutAt: new Date('2026-12-18T11:00:00Z'),
        },
      });
    });

    it('should allow only one review and reject concurrent duplicate with 409 REVIEW_ALREADY_EXISTS', async () => {
      const reviewPayload = {
        bookingId: reviewBookingId,
        rating: 5,
        title: 'Outstanding stay',
        comment: 'Clean rooms and great service.',
      };

      const [resRev1, resRev2] = await Promise.all([
        request(server)
          .post('/api/v1/reviews')
          .set('Authorization', `Bearer ${customer1Token}`)
          .send(reviewPayload),
        request(server)
          .post('/api/v1/reviews')
          .set('Authorization', `Bearer ${customer1Token}`)
          .send(reviewPayload),
      ]);

      const responses = [resRev1, resRev2];
      const success = responses.filter((r) => r.status === 201);
      const conflict = responses.filter((r) => r.status === 409);

      expect(success.length).toBe(1);
      expect(conflict.length).toBe(1);
      expect(conflict[0].body.error.code).toBe('REVIEW_ALREADY_EXISTS');

      // Database verification: Exactly 1 review record exists for this booking
      const dbReviews = await prisma.review.findMany({
        where: { bookingId: reviewBookingId },
      });
      expect(dbReviews.length).toBe(1);
    });
  });
});
