import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { GlobalExceptionFilter, TransformInterceptor } from '../src/common';
import { BookingStatus } from '../src/modules/bookings/types/booking-status.enum';
import {
  PaymentStatus,
  PaymentAttemptStatus,
} from '../src/modules/payments/types/payment-status.enum';

describe('Payments & Payment Attempts (e2e)', () => {
  let app: INestApplication;
  let server: App;
  let prisma: PrismaService;

  let customerAToken: string;
  let customerBToken: string;
  let managerToken: string;
  let adminToken: string;

  let customerAUserId: string;
  const customerBUserId = '22222222-2222-4222-8222-222222222299';
  const HOTEL_MUMBAI_ID = '44444444-4444-4444-8444-444444444444';

  let roomTypeId: string;
  let physicalRoomId: string;

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
      update: { passwordHash },
      create: {
        id: customerBUserId,
        email: 'customer.payments.b@stayora.com',
        passwordHash,
        firstName: 'Bob',
        lastName: 'Customer',
        role: 'CUSTOMER',
        status: 'ACTIVE',
      },
    });

    const resCustB = await request(server)
      .post('/api/v1/auth/customer/login')
      .send({ email: 'customer.payments.b@stayora.com', password: 'Password123!' });
    customerBToken = resCustB.body.data.accessToken;

    const resManager = await request(server)
      .post('/api/v1/auth/manager/login')
      .send({ email: 'manager@stayora.com', password: 'Password123!' });
    managerToken = resManager.body.data.accessToken;

    const resAdmin = await request(server)
      .post('/api/v1/auth/admin/login')
      .send({ email: 'admin@stayora.com', password: 'Password123!' });
    adminToken = resAdmin.body.data.accessToken;

    // Get a room type and room from Mumbai hotel
    const rt = await prisma.roomType.findFirst({
      where: { hotelId: HOTEL_MUMBAI_ID },
      include: { rooms: true },
    });
    roomTypeId = rt!.id;
    physicalRoomId = rt!.rooms[0].id;
  });

  afterAll(async () => {
    // Clean up created test entities
    if (createdBookingIds.length > 0) {
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
      await prisma.bookingGuest.deleteMany({
        where: { bookingId: { in: createdBookingIds } },
      });
      await prisma.booking.deleteMany({
        where: { id: { in: createdBookingIds } },
      });
    }

    await app.close();
  });

  // Helper to create a standalone test booking
  async function createTestBooking(
    customerId: string,
    daysAhead = 30,
    status: string = BookingStatus.PENDING,
  ): Promise<string> {
    const checkIn = new Date();
    checkIn.setDate(checkIn.getDate() + daysAhead);
    checkIn.setHours(14, 0, 0, 0);

    const checkOut = new Date(checkIn);
    checkOut.setDate(checkOut.getDate() + 2);
    checkOut.setHours(11, 0, 0, 0);

    const ref = `BK-${Date.now().toString().slice(-8)}-${Math.floor(Math.random() * 900 + 100)}`;

    const booking = await prisma.booking.create({
      data: {
        bookingReference: ref,
        customerId,
        hotelId: HOTEL_MUMBAI_ID,
        status,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        totalNights: 2,
        totalGuests: 2,
        totalAmountCents: BigInt(1500000), // 15000.00
        currency: 'INR',
        holdExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
        priceSnapshot: {
          create: {
            baseRateCents: BigInt(650000),
            totalNights: 2,
            grossRoomCents: BigInt(1300000),
            taxCents: BigInt(200000),
            netAmountCents: BigInt(1500000),
            currency: 'INR',
          },
        },
      },
    });

    createdBookingIds.push(booking.id);
    return booking.id;
  }

  describe('1. Authentication & Authorization Controls', () => {
    let testBookingId: string;

    beforeAll(async () => {
      testBookingId = await createTestBooking(customerAUserId, 40);
    });

    it('POST /api/v1/payments should reject unauthenticated requests (401)', async () => {
      await request(server)
        .post('/api/v1/payments')
        .set('Idempotency-Key', 'IDEMP-UNAUTH-01')
        .send({ bookingId: testBookingId })
        .expect(401);
    });

    it('GET /api/v1/payments/:id should reject unauthenticated requests (401)', async () => {
      await request(server)
        .get(`/api/v1/payments/3fa85f64-5717-4562-b3fc-2c963f66afa6`)
        .expect(401);
    });

    it('POST /api/v1/payments should forbid managers (403)', async () => {
      await request(server)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${managerToken}`)
        .set('Idempotency-Key', 'IDEMP-MGR-01')
        .send({ bookingId: testBookingId })
        .expect(403);
    });

    it('GET /api/v1/payments/:id should forbid managers from accessing payment details (403)', async () => {
      await request(server)
        .get(`/api/v1/payments/3fa85f64-5717-4562-b3fc-2c963f66afa6`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(403);
    });

    it('GET /api/v1/payments should forbid managers from listing payments (403)', async () => {
      await request(server)
        .get('/api/v1/payments')
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(403);
    });

    it('POST /api/v1/payments should forbid Customer B from paying Customer A booking (403)', async () => {
      await request(server)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${customerBToken}`)
        .set('Idempotency-Key', 'IDEMP-IDOR-01')
        .send({ bookingId: testBookingId })
        .expect(403);
    });
  });

  describe('2. Input & Booking Validation', () => {
    let testBookingId: string;

    beforeAll(async () => {
      testBookingId = await createTestBooking(customerAUserId, 45);
    });

    it('should reject payment creation without Idempotency-Key header (400)', async () => {
      const res = await request(server)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ bookingId: testBookingId })
        .expect(400);

      expect(res.body.error.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
    });

    it('should reject invalid UUID for bookingId (400)', async () => {
      await request(server)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${customerAToken}`)
        .set('Idempotency-Key', 'IDEMP-INVALID-UUID')
        .send({ bookingId: 'not-a-valid-uuid' })
        .expect(400);
    });

    it('should return 404 if booking does not exist', async () => {
      const nonExistentBooking = '99999999-9999-4999-8999-999999999999';
      const res = await request(server)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${customerAToken}`)
        .set('Idempotency-Key', 'IDEMP-NOT-FOUND')
        .send({ bookingId: nonExistentBooking })
        .expect(404);

      expect(res.body.error.code).toBe('BOOKING_NOT_FOUND');
    });

    it('should reject payment if booking is CANCELLED (400)', async () => {
      const cancelledBookingId = await createTestBooking(
        customerAUserId,
        50,
        BookingStatus.CANCELLED,
      );

      const res = await request(server)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${customerAToken}`)
        .set('Idempotency-Key', 'IDEMP-CANCELLED')
        .send({ bookingId: cancelledBookingId })
        .expect(400);

      expect(res.body.error.code).toBe('BOOKING_NOT_PAYABLE');
    });
  });

  describe('3. Successful Payment Flow & Lifecycle', () => {
    let bookingId: string;
    let paymentId: string;
    const idempotencyKey = `IDEMP-SUCCESS-${Date.now()}`;

    beforeAll(async () => {
      bookingId = await createTestBooking(customerAUserId, 55);
    });

    it('should process payment successfully and confirm the booking (201)', async () => {
      const res = await request(server)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${customerAToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          bookingId,
          paymentMethod: 'CARD',
        })
        .expect(201);

      const data = res.body.data;
      paymentId = data.id;

      expect(data.id).toBeDefined();
      expect(data.bookingId).toBe(bookingId);
      expect(data.status).toBe(PaymentStatus.SUCCEEDED);
      expect(data.amount).toBe('15000.00'); // Authoritative booking amount (1500000 cents)
      expect(data.currency).toBe('INR');
      expect(data.gatewayProvider).toBe('MOCK');
      expect(data.settledAt).toBeDefined();

      // Check nested attempts
      expect(Array.isArray(data.attempts)).toBe(true);
      expect(data.attempts.length).toBe(1);
      expect(data.attempts[0].attemptNumber).toBe(1);
      expect(data.attempts[0].idempotencyKey).toBe(idempotencyKey);
      expect(data.attempts[0].status).toBe(PaymentAttemptStatus.SUCCEEDED);
      expect(data.attempts[0].gatewayReference).toBeDefined();

      // Verify Database state
      const dbBooking = await prisma.booking.findUnique({
        where: { id: bookingId },
      });
      expect(dbBooking!.status).toBe(BookingStatus.CONFIRMED);

      const dbPayment = await prisma.payment.findUnique({
        where: { id: paymentId },
        include: { attempts: true },
      });
      expect(dbPayment!.status).toBe(PaymentStatus.SUCCEEDED);
      expect(dbPayment!.attempts.length).toBe(1);
      expect(dbPayment!.attempts[0].status).toBe(PaymentAttemptStatus.SUCCEEDED);
    });

    it('GET /api/v1/payments/:id should return complete payment details', async () => {
      const res = await request(server)
        .get(`/api/v1/payments/${paymentId}`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .expect(200);

      const data = res.body.data;
      expect(data.id).toBe(paymentId);
      expect(data.bookingId).toBe(bookingId);
      expect(data.status).toBe(PaymentStatus.SUCCEEDED);
      expect(data.attempts.length).toBe(1);
    });
  });

  describe('4. Idempotency Invariant & Replay', () => {
    let bookingId: string;
    let paymentId: string;
    const idempotencyKey = `IDEMP-REPLAY-${Date.now()}`;

    beforeAll(async () => {
      bookingId = await createTestBooking(customerAUserId, 60);

      // Initial payment request
      const res = await request(server)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${customerAToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send({ bookingId })
        .expect(201);

      paymentId = res.body.data.id;
    });

    it('should return identical result and NOT create duplicate payment/attempt on retry', async () => {
      const resReplay = await request(server)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${customerAToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send({ bookingId })
        .expect(201);

      const data = resReplay.body.data;
      expect(data.id).toBe(paymentId);
      expect(data.status).toBe(PaymentStatus.SUCCEEDED);
      expect(data.attempts.length).toBe(1);

      // Confirm in DB that no second payment or attempt was created
      const attemptsCount = await prisma.paymentAttempt.count({
        where: { paymentId },
      });
      expect(attemptsCount).toBe(1);
    });

    it('should reject with 409 CONFLICT if the same Idempotency-Key is reused for a different booking', async () => {
      const otherBookingId = await createTestBooking(customerAUserId, 65);

      const res = await request(server)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${customerAToken}`)
        .set('Idempotency-Key', idempotencyKey) // Reusing same key on different booking
        .send({ bookingId: otherBookingId })
        .expect(409);

      expect(res.body.error.code).toBe('IDEMPOTENCY_KEY_REUSED');
    });

    it('should reject with 409 CONFLICT if attempting payment with a NEW key on already paid booking', async () => {
      const newKey = `IDEMP-NEW-ON-PAID-${Date.now()}`;

      const res = await request(server)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${customerAToken}`)
        .set('Idempotency-Key', newKey)
        .send({ bookingId })
        .expect(409);

      expect(res.body.error.code).toBe('PAYMENT_ALREADY_COMPLETED');
    });
  });

  describe('5. Failed Payment & Multi-Attempt Retry Flow', () => {
    let bookingId: string;
    let paymentId: string;
    const failKey = `IDEMP-FAIL-${Date.now()}`;
    const retryKey = `IDEMP-RETRY-${Date.now()}`;

    beforeAll(async () => {
      bookingId = await createTestBooking(customerAUserId, 70);
    });

    it('should record failed payment attempt, keep booking PENDING, and not confirm', async () => {
      const res = await request(server)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${customerAToken}`)
        .set('Idempotency-Key', failKey)
        .send({
          bookingId,
          simulateResult: 'FAILED',
          simulateFailureReason: 'Card declined: Insufficient balance',
        })
        .expect(201);

      const data = res.body.data;
      paymentId = data.id;

      expect(data.status).toBe(PaymentStatus.FAILED);
      expect(data.failureReason).toContain('Insufficient balance');
      expect(data.attempts.length).toBe(1);
      expect(data.attempts[0].attemptNumber).toBe(1);
      expect(data.attempts[0].status).toBe(PaymentAttemptStatus.FAILED);

      // Verify booking is still PENDING so user can retry
      const dbBooking = await prisma.booking.findUnique({
        where: { id: bookingId },
      });
      expect(dbBooking!.status).toBe(BookingStatus.PENDING);
    });

    it('should allow customer to retry with new Idempotency-Key, preserving attempt 1 in audit ledger', async () => {
      const res = await request(server)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${customerAToken}`)
        .set('Idempotency-Key', retryKey)
        .send({
          bookingId,
          simulateResult: 'SUCCESS',
        })
        .expect(201);

      const data = res.body.data;
      expect(data.id).toBe(paymentId); // Same logical payment record reused
      expect(data.status).toBe(PaymentStatus.SUCCEEDED);

      // Verify attempts ledger: Attempt 1 is FAILED, Attempt 2 is SUCCEEDED
      expect(data.attempts.length).toBe(2);
      expect(data.attempts[0].attemptNumber).toBe(1);
      expect(data.attempts[0].status).toBe(PaymentAttemptStatus.FAILED);
      expect(data.attempts[0].idempotencyKey).toBe(failKey);

      expect(data.attempts[1].attemptNumber).toBe(2);
      expect(data.attempts[1].status).toBe(PaymentAttemptStatus.SUCCEEDED);
      expect(data.attempts[1].idempotencyKey).toBe(retryKey);

      // Verify Booking is now CONFIRMED
      const dbBooking = await prisma.booking.findUnique({
        where: { id: bookingId },
      });
      expect(dbBooking!.status).toBe(BookingStatus.CONFIRMED);
    });
  });

  describe('6. Concurrency Safety & Race Condition Protection', () => {
    it('Concurrent requests with SAME Idempotency-Key: exactly one attempt processed', async () => {
      const bookingId = await createTestBooking(customerAUserId, 80);
      const sharedKey = `IDEMP-CONCUR-SAME-${Date.now()}`;

      // Launch 3 simultaneous requests with identical idempotency key
      const results = await Promise.all([
        request(server)
          .post('/api/v1/payments')
          .set('Authorization', `Bearer ${customerAToken}`)
          .set('Idempotency-Key', sharedKey)
          .send({ bookingId }),
        request(server)
          .post('/api/v1/payments')
          .set('Authorization', `Bearer ${customerAToken}`)
          .set('Idempotency-Key', sharedKey)
          .send({ bookingId }),
        request(server)
          .post('/api/v1/payments')
          .set('Authorization', `Bearer ${customerAToken}`)
          .set('Idempotency-Key', sharedKey)
          .send({ bookingId }),
      ]);

      for (const res of results) {
        expect(res.status).toBe(201);
        expect(res.body.data.status).toBe(PaymentStatus.SUCCEEDED);
      }

      // Assert that exactly ONE payment attempt was created in the database
      const attempts = await prisma.paymentAttempt.findMany({
        where: { bookingId },
      });
      expect(attempts.length).toBe(1);
      expect(attempts[0].idempotencyKey).toBe(sharedKey);
      expect(attempts[0].status).toBe(PaymentAttemptStatus.SUCCEEDED);
    });

    it('Concurrent requests with DIFFERENT Idempotency-Keys: exactly one succeeds, other fails 409', async () => {
      const bookingId = await createTestBooking(customerAUserId, 85);
      const keyA = `IDEMP-CONCUR-DIFF-A-${Date.now()}`;
      const keyB = `IDEMP-CONCUR-DIFF-B-${Date.now()}`;

      // Launch 2 simultaneous requests with different keys for the same booking
      const [resA, resB] = await Promise.all([
        request(server)
          .post('/api/v1/payments')
          .set('Authorization', `Bearer ${customerAToken}`)
          .set('Idempotency-Key', keyA)
          .send({ bookingId }),
        request(server)
          .post('/api/v1/payments')
          .set('Authorization', `Bearer ${customerAToken}`)
          .set('Idempotency-Key', keyB)
          .send({ bookingId }),
      ]);

      const statuses = [resA.status, resB.status].sort();
      // One request must succeed (201) and the second must be rejected (409)
      expect(statuses).toEqual([201, 409]);

      const conflictRes = resA.status === 409 ? resA : resB;
      expect(conflictRes.body.error.code).toBe('PAYMENT_ALREADY_COMPLETED');

      // Booking is CONFIRMED and paid exactly once
      const dbBooking = await prisma.booking.findUnique({
        where: { id: bookingId },
      });
      expect(dbBooking!.status).toBe(BookingStatus.CONFIRMED);

      const dbPayments = await prisma.payment.findMany({
        where: { bookingId },
      });
      expect(dbPayments.length).toBe(1);
      expect(dbPayments[0].status).toBe(PaymentStatus.SUCCEEDED);
    });
  });

  describe('7. Resource Protection, Data Exposure & Admin Access', () => {
    let customerAPaymentId: string;

    beforeAll(async () => {
      const bookingId = await createTestBooking(customerAUserId, 90);
      const res = await request(server)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${customerAToken}`)
        .set('Idempotency-Key', `IDEMP-DATA-EXP-${Date.now()}`)
        .send({ bookingId })
        .expect(201);

      customerAPaymentId = res.body.data.id;
    });

    it('Customer B cannot access Customer A payment details (403)', async () => {
      await request(server)
        .get(`/api/v1/payments/${customerAPaymentId}`)
        .set('Authorization', `Bearer ${customerBToken}`)
        .expect(403);
    });

    it('Admin can view Customer A payment details (200)', async () => {
      const res = await request(server)
        .get(`/api/v1/payments/${customerAPaymentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.id).toBe(customerAPaymentId);
      expect(res.body.data.status).toBe(PaymentStatus.SUCCEEDED);
    });

    it('Customer A listing payments only returns Customer A payments', async () => {
      const res = await request(server)
        .get('/api/v1/payments')
        .set('Authorization', `Bearer ${customerAToken}`)
        .expect(200);

      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(
        res.body.data.items.some(
          (p: any) => p.id === customerAPaymentId,
        ),
      ).toBe(true);
    });

    it('Payment response must NOT leak sensitive card or internal database fields', async () => {
      const res = await request(server)
        .get(`/api/v1/payments/${customerAPaymentId}`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .expect(200);

      const jsonStr = JSON.stringify(res.body);
      expect(jsonStr).not.toContain('password');
      expect(jsonStr).not.toContain('cvv');
      expect(jsonStr).not.toContain('cardNumber');
      expect(jsonStr).not.toContain('secret');
      expect(jsonStr).not.toContain('token');
    });
  });
});
