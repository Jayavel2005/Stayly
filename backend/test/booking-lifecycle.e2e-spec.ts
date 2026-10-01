import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { GlobalExceptionFilter, TransformInterceptor } from '../src/common';
import { BookingStatus } from '../src/modules/bookings/types/booking-status.enum';

describe('Booking Lifecycle & Cancellation (e2e)', () => {
  let app: INestApplication;
  let server: App;
  let prisma: PrismaService;

  let customerAToken: string;
  let customerBToken: string;
  let managerAToken: string;
  let managerBToken: string;
  let adminToken: string;

  const HOTEL_MUMBAI_ID = '44444444-4444-4444-8444-444444444444';
  const HOTEL_GOA_ID = '55555555-5555-4555-8555-555555555555';
  const customerBUserId = '77777777-7777-4777-8777-111111111111';
  const managerBUserId = '88888888-8888-4888-8888-222222222222';

  let testRoomTypeId: string;
  let testRoomId: string;
  let concurrencyRoomTypeId: string;
  let concurrencyRoomId: string;

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

    // 1. Customer A Login
    const resCustA = await request(server)
      .post('/api/v1/auth/customer/login')
      .send({ email: 'customer@stayora.com', password: 'Password123!' });
    customerAToken = resCustA.body.data.accessToken;

    // 2. Customer B Login
    await prisma.user.upsert({
      where: { id: customerBUserId },
      update: { passwordHash },
      create: {
        id: customerBUserId,
        email: 'customer.lifecycle.b@stayora.com',
        passwordHash,
        firstName: 'Bhavna',
        lastName: 'Patel',
        role: 'CUSTOMER',
        status: 'ACTIVE',
      },
    });

    const resCustB = await request(server)
      .post('/api/v1/auth/customer/login')
      .send({ email: 'customer.lifecycle.b@stayora.com', password: 'Password123!' });
    customerBToken = resCustB.body.data.accessToken;

    // 3. Manager A (assigned to Mumbai)
    const resMgrA = await request(server)
      .post('/api/v1/auth/manager/login')
      .send({ email: 'manager@stayora.com', password: 'Password123!' });
    managerAToken = resMgrA.body.data.accessToken;

    // 4. Manager B (assigned ONLY to Goa)
    await prisma.user.upsert({
      where: { id: managerBUserId },
      update: { passwordHash },
      create: {
        id: managerBUserId,
        email: 'manager.goa.lifecycle@stayora.com',
        passwordHash,
        firstName: 'Siddharth',
        lastName: 'Rao',
        role: 'HOTEL_MANAGER',
        status: 'ACTIVE',
      },
    });

    await prisma.hotelManager.upsert({
      where: {
        userId_hotelId: {
          userId: managerBUserId,
          hotelId: HOTEL_GOA_ID,
        },
      },
      update: {},
      create: {
        userId: managerBUserId,
        hotelId: HOTEL_GOA_ID,
      },
    });

    const resMgrB = await request(server)
      .post('/api/v1/auth/manager/login')
      .send({ email: 'manager.goa.lifecycle@stayora.com', password: 'Password123!' });
    managerBToken = resMgrB.body.data.accessToken;

    // 5. Admin Login
    const resAdmin = await request(server)
      .post('/api/v1/auth/admin/login')
      .send({ email: 'admin@stayora.com', password: 'Password123!' });
    adminToken = resAdmin.body.data.accessToken;

    // 6. Setup dedicated test RoomType and single physical Room for availability/lifecycle tests
    const roomType = await prisma.roomType.create({
      data: {
        hotelId: HOTEL_MUMBAI_ID,
        name: 'Lifecycle Penthouse Suite',
        description: 'A luxurious penthouse suite for lifecycle testing',
        slug: `lifecycle-suite-${Date.now()}`,
        basePriceCents: BigInt(500000),
        currency: 'INR',
        maxOccupancy: 2,
        isActive: true,
      },
    });
    testRoomTypeId = roomType.id;

    const room = await prisma.room.create({
      data: {
        hotelId: HOTEL_MUMBAI_ID,
        roomTypeId: testRoomTypeId,
        roomNumber: `LIFECYCLE-${Date.now().toString().slice(-4)}`,
        floor: 10,
        operationalStatus: 'AVAILABLE',
      },
    });
    testRoomId = room.id;

    // 7. Setup dedicated room for concurrency tests
    const concurrencyRt = await prisma.roomType.create({
      data: {
        hotelId: HOTEL_MUMBAI_ID,
        name: 'Lifecycle Concurrency Suite',
        description: 'A dedicated suite for lifecycle concurrency testing',
        slug: `lifecycle-conc-${Date.now()}`,
        basePriceCents: BigInt(300000),
        currency: 'INR',
        maxOccupancy: 2,
        isActive: true,
      },
    });
    concurrencyRoomTypeId = concurrencyRt.id;

    const concRoom = await prisma.room.create({
      data: {
        hotelId: HOTEL_MUMBAI_ID,
        roomTypeId: concurrencyRoomTypeId,
        roomNumber: `CONC-${Date.now().toString().slice(-4)}`,
        floor: 8,
        operationalStatus: 'AVAILABLE',
      },
    });
    concurrencyRoomId = concRoom.id;
  });

  afterAll(async () => {
    if (createdBookingIds.length > 0) {
      await prisma.auditLog.deleteMany({
        where: { entityId: { in: createdBookingIds } },
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

    if (testRoomId) {
      await prisma.room.deleteMany({ where: { id: testRoomId } });
    }
    if (testRoomTypeId) {
      await prisma.roomType.deleteMany({ where: { id: testRoomTypeId } });
    }
    if (concurrencyRoomId) {
      await prisma.room.deleteMany({ where: { id: concurrencyRoomId } });
    }
    if (concurrencyRoomTypeId) {
      await prisma.roomType.deleteMany({ where: { id: concurrencyRoomTypeId } });
    }

    await prisma.hotelManager.deleteMany({
      where: { userId: managerBUserId },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [customerBUserId, managerBUserId] } },
    });

    await app.close();
  });

  // ===========================================================================
  // 1. Customer Cancellation Flow & Restrictions
  // ===========================================================================
  describe('Customer Cancellation Flow', () => {
    it('customer can cancel own booking via POST /api/v1/bookings/:id/cancel', async () => {
      const createRes = await request(server)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          hotelId: HOTEL_MUMBAI_ID,
          roomTypeId: testRoomTypeId,
          checkIn: '2026-11-01',
          checkOut: '2026-11-04',
          guests: 2,
          rooms: 1,
        })
        .expect(201);

      const bookingId = createRes.body.data.id;
      createdBookingIds.push(bookingId);

      const res = await request(server)
        .post(`/api/v1/bookings/${bookingId}/cancel`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ reason: 'Trip rescheduled' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(bookingId);
      expect(res.body.data.status).toBe(BookingStatus.CANCELLED);
      expect(res.body.data.cancelledAt).toBeDefined();
      expect(res.body.data.cancellationReason).toBe('Trip rescheduled');
      expect(res.body.data.message).toBe('Booking cancelled successfully.');

      // Verify allocations in database are marked CANCELLED (not deleted!)
      const dbRooms = await prisma.bookingRoom.findMany({
        where: { bookingId },
      });
      expect(dbRooms.length).toBe(1);
      expect(dbRooms[0].status).toBe('CANCELLED');

      // Verify audit log record exists
      const audit = await prisma.auditLog.findFirst({
        where: { entityId: bookingId, action: 'booking.cancelled' },
      });
      expect(audit).toBeDefined();
    });

    it('customer cannot cancel another customer booking (IDOR defense 404)', async () => {
      const createRes = await request(server)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          hotelId: HOTEL_MUMBAI_ID,
          roomTypeId: testRoomTypeId,
          checkIn: '2026-11-04',
          checkOut: '2026-11-07',
          guests: 2,
          rooms: 1,
        })
        .expect(201);

      const bookingId = createRes.body.data.id;
      createdBookingIds.push(bookingId);

      const res = await request(server)
        .post(`/api/v1/bookings/${bookingId}/cancel`)
        .set('Authorization', `Bearer ${customerBToken}`)
        .send({ reason: 'Malicious cancel attempt' })
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BOOKING_NOT_FOUND');
    });

    it('cannot cancel an already cancelled booking (400 BOOKING_ALREADY_CANCELLED)', async () => {
      const createRes = await request(server)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          hotelId: HOTEL_MUMBAI_ID,
          roomTypeId: testRoomTypeId,
          checkIn: '2026-11-07',
          checkOut: '2026-11-10',
          guests: 2,
          rooms: 1,
        })
        .expect(201);

      const bookingId = createRes.body.data.id;
      createdBookingIds.push(bookingId);

      // First cancel succeeds
      await request(server)
        .post(`/api/v1/bookings/${bookingId}/cancel`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ reason: 'Initial cancel' })
        .expect(200);

      // Second cancel rejected
      const res = await request(server)
        .post(`/api/v1/bookings/${bookingId}/cancel`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ reason: 'Duplicate cancel' })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BOOKING_ALREADY_CANCELLED');
    });
  });

  // ===========================================================================
  // 2. Manager & Operational Check-In / Check-Out Lifecycle
  // ===========================================================================
  describe('Operational Lifecycle (Check-In & Check-Out)', () => {
    let lifecycleBookingId: string;

    beforeAll(async () => {
      const res = await request(server)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          hotelId: HOTEL_MUMBAI_ID,
          roomTypeId: testRoomTypeId,
          checkIn: '2026-11-10',
          checkOut: '2026-11-13',
          guests: 2,
          rooms: 1,
        });
      lifecycleBookingId = res.body.data.id;
      createdBookingIds.push(lifecycleBookingId);
    });

    it('should reject check-in while booking is PENDING (400 BOOKING_NOT_CHECKINABLE)', async () => {
      const res = await request(server)
        .post(`/api/v1/bookings/${lifecycleBookingId}/check-in`)
        .set('Authorization', `Bearer ${managerAToken}`)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BOOKING_NOT_CHECKINABLE');
    });

    it('should reject customer attempting check-in (403 Forbidden)', async () => {
      const res = await request(server)
        .post(`/api/v1/bookings/${lifecycleBookingId}/check-in`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .expect(403);

      expect(res.body.success).toBe(false);
    });

    it('should reject manager not assigned to property (404/403 IDOR defense)', async () => {
      // Manager B is assigned to Goa, attempting check-in on Mumbai booking
      const res = await request(server)
        .post(`/api/v1/bookings/${lifecycleBookingId}/check-in`)
        .set('Authorization', `Bearer ${managerBToken}`)
        .expect(404);

      expect(res.body.success).toBe(false);
    });

    it('transition PENDING -> CONFIRMED via payment', async () => {
      const payRes = await request(server)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${customerAToken}`)
        .set('Idempotency-Key', `pay-lifecycle-${Date.now()}`)
        .send({
          bookingId: lifecycleBookingId,
          paymentMethod: 'UPI',
        })
        .expect(201);

      expect(payRes.body.data.status).toBe('SUCCEEDED');
      const updatedBooking = await prisma.booking.findUnique({
        where: { id: lifecycleBookingId },
      });
      expect(updatedBooking?.status).toBe(BookingStatus.CONFIRMED);
    });

    it('manager checks in CONFIRMED booking -> CHECKED_IN, marks room OCCUPIED', async () => {
      const res = await request(server)
        .post(`/api/v1/bookings/${lifecycleBookingId}/check-in`)
        .set('Authorization', `Bearer ${managerAToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe(BookingStatus.CHECKED_IN);
      expect(res.body.data.checkedInAt).toBeDefined();
      expect(res.body.data.message).toBe('Booking checked in successfully.');

      // Check physical room allocation status
      const dbRooms = await prisma.bookingRoom.findMany({
        where: { bookingId: lifecycleBookingId },
      });
      expect(dbRooms[0].status).toBe('OCCUPIED');

      // Check audit log
      const audit = await prisma.auditLog.findFirst({
        where: { entityId: lifecycleBookingId, action: 'booking.checked_in' },
      });
      expect(audit).toBeDefined();
    });

    it('should reject cancelling a CHECKED_IN booking (400 BOOKING_NOT_CANCELLABLE)', async () => {
      const res = await request(server)
        .post(`/api/v1/bookings/${lifecycleBookingId}/cancel`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ reason: 'Want refund after check-in' })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BOOKING_NOT_CANCELLABLE');
    });

    it('should reject repeated check-in (400 BOOKING_ALREADY_CHECKED_IN)', async () => {
      const res = await request(server)
        .post(`/api/v1/bookings/${lifecycleBookingId}/check-in`)
        .set('Authorization', `Bearer ${managerAToken}`)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BOOKING_ALREADY_CHECKED_IN');
    });

    it('manager checks out CHECKED_IN booking -> CHECKED_OUT, marks room RELEASED', async () => {
      const res = await request(server)
        .post(`/api/v1/bookings/${lifecycleBookingId}/check-out`)
        .set('Authorization', `Bearer ${managerAToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe(BookingStatus.CHECKED_OUT);
      expect(res.body.data.checkedOutAt).toBeDefined();
      expect(res.body.data.message).toBe('Booking checked out successfully.');

      // Verify allocation marked RELEASED
      const dbRooms = await prisma.bookingRoom.findMany({
        where: { bookingId: lifecycleBookingId },
      });
      expect(dbRooms[0].status).toBe('RELEASED');

      // Check audit log
      const audit = await prisma.auditLog.findFirst({
        where: { entityId: lifecycleBookingId, action: 'booking.checked_out' },
      });
      expect(audit).toBeDefined();
    });

    it('should reject repeated check-out (400 BOOKING_ALREADY_COMPLETED)', async () => {
      const res = await request(server)
        .post(`/api/v1/bookings/${lifecycleBookingId}/check-out`)
        .set('Authorization', `Bearer ${managerAToken}`)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BOOKING_ALREADY_COMPLETED');
    });

    it('should reject check-in on completed/checked-out booking (400 BOOKING_NOT_CHECKINABLE)', async () => {
      const res = await request(server)
        .post(`/api/v1/bookings/${lifecycleBookingId}/check-in`)
        .set('Authorization', `Bearer ${managerAToken}`)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BOOKING_NOT_CHECKINABLE');
    });

    it('should reject cancelling a completed/checked-out booking (400 INVALID_STATE_TRANSITION)', async () => {
      const res = await request(server)
        .post(`/api/v1/bookings/${lifecycleBookingId}/cancel`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_STATE_TRANSITION');
    });
  });

  // ===========================================================================
  // 3. Availability Integration After Cancellation & Completion
  // ===========================================================================
  describe('Availability Integration', () => {
    it('CONFIRMED booking blocks room; CANCELLED booking frees up room immediately', async () => {
      const checkIn = '2026-11-20';
      const checkOut = '2026-11-23';

      // 1. Create booking for the sole penthouse room
      const bookRes = await request(server)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          hotelId: HOTEL_MUMBAI_ID,
          roomTypeId: testRoomTypeId,
          checkIn,
          checkOut,
          guests: 2,
          rooms: 1,
        })
        .expect(201);

      const bId = bookRes.body.data.id;
      createdBookingIds.push(bId);

      // Confirm with payment
      await request(server)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${customerAToken}`)
        .set('Idempotency-Key', `pay-avail-${Date.now()}`)
        .send({
          bookingId: bId,
          paymentMethod: 'NET_BANKING',
        })
        .expect(201);

      // 2. Query availability for same dates -> must be 0 available rooms
      const availBeforeCancel = await request(server)
        .get(`/api/v1/availability/room-types/${testRoomTypeId}`)
        .query({ checkIn, checkOut })
        .expect(200);

      expect(availBeforeCancel.body.data.availableRooms).toBe(0);
      expect(availBeforeCancel.body.data.hasAvailability).toBe(false);

      // 3. Cancel the booking
      await request(server)
        .post(`/api/v1/bookings/${bId}/cancel`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ reason: 'Emergency cancellation' })
        .expect(200);

      // 4. Query availability again -> room is immediately available again!
      const availAfterCancel = await request(server)
        .get(`/api/v1/availability/room-types/${testRoomTypeId}`)
        .query({ checkIn, checkOut })
        .expect(200);

      expect(availAfterCancel.body.data.availableRooms).toBe(1);
      expect(availAfterCancel.body.data.hasAvailability).toBe(true);

      // Historical record still exists in database!
      const historicalBooking = await prisma.booking.findUnique({
        where: { id: bId },
      });
      expect(historicalBooking).toBeDefined();
      expect(historicalBooking?.status).toBe(BookingStatus.CANCELLED);
    });
  });

  // ===========================================================================
  // 4. Payment State Consistency During Cancellation (No Fake Refunds)
  // ===========================================================================
  describe('Payment Consistency', () => {
    it('cancelling a paid booking preserves payment record as SUCCEEDED without creating fake refunds', async () => {
      const res = await request(server)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          hotelId: HOTEL_MUMBAI_ID,
          roomTypeId: testRoomTypeId,
          checkIn: '2026-11-25',
          checkOut: '2026-11-28',
          guests: 2,
          rooms: 1,
        })
        .expect(201);

      const bId = res.body.data.id;
      createdBookingIds.push(bId);

      // Pay successfully
      await request(server)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${customerAToken}`)
        .set('Idempotency-Key', `pay-consistency-${Date.now()}`)
        .send({
          bookingId: bId,
          paymentMethod: 'CARD',
        })
        .expect(201);

      const paymentBefore = await prisma.payment.findUnique({
        where: { bookingId: bId },
      });
      expect(paymentBefore?.status).toBe('SUCCEEDED');

      // Cancel the booking
      await request(server)
        .post(`/api/v1/bookings/${bId}/cancel`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ reason: 'Cancelled by customer' })
        .expect(200);

      // Verify payment record is still SUCCEEDED and no fake refund record was generated
      const paymentAfter = await prisma.payment.findUnique({
        where: { bookingId: bId },
      });
      expect(paymentAfter?.status).toBe('SUCCEEDED');

      const refunds = await prisma.refund.findMany({
        where: { bookingId: bId },
      });
      expect(refunds.length).toBe(0);
    });
  });

  // ===========================================================================
  // 5. Concurrency & Race Condition Defense
  // ===========================================================================
  describe('Concurrency & Serialization Protection', () => {
    it('concurrent check-in requests on the same booking are serialized; exactly one succeeds', async () => {
      // Create confirmed booking
      const bookRes = await request(server)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          hotelId: HOTEL_MUMBAI_ID,
          roomTypeId: concurrencyRoomTypeId,
          checkIn: '2026-12-01',
          checkOut: '2026-12-04',
          guests: 2,
          rooms: 1,
        })
        .expect(201);

      const concBookingId = bookRes.body.data.id;
      createdBookingIds.push(concBookingId);

      await request(server)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${customerAToken}`)
        .set('Idempotency-Key', `pay-conc-${Date.now()}`)
        .send({
          bookingId: concBookingId,
          paymentMethod: 'UPI',
        })
        .expect(201);

      // Fire 2 simultaneous check-in requests
      const checkIn1 = request(server)
        .post(`/api/v1/bookings/${concBookingId}/check-in`)
        .set('Authorization', `Bearer ${managerAToken}`);

      const checkIn2 = request(server)
        .post(`/api/v1/bookings/${concBookingId}/check-in`)
        .set('Authorization', `Bearer ${managerAToken}`);

      const [res1, res2] = await Promise.all([checkIn1, checkIn2]);
      const statuses = [res1.status, res2.status];

      expect(statuses).toContain(200);
      expect(statuses).toContain(400);

      const successRes = res1.status === 200 ? res1 : res2;
      const failedRes = res1.status === 400 ? res1 : res2;

      expect(successRes.body.data.status).toBe(BookingStatus.CHECKED_IN);
      expect(failedRes.body.error.code).toBe('BOOKING_ALREADY_CHECKED_IN');
    });

    it('concurrent cancel requests on the same booking: exactly one succeeds with 200', async () => {
      const bookRes = await request(server)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          hotelId: HOTEL_MUMBAI_ID,
          roomTypeId: concurrencyRoomTypeId,
          checkIn: '2026-12-05',
          checkOut: '2026-12-08',
          guests: 2,
          rooms: 1,
        })
        .expect(201);

      const concBookingId = bookRes.body.data.id;
      createdBookingIds.push(concBookingId);

      const cancel1 = request(server)
        .post(`/api/v1/bookings/${concBookingId}/cancel`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ reason: 'Concurrent cancel 1' });

      const cancel2 = request(server)
        .post(`/api/v1/bookings/${concBookingId}/cancel`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ reason: 'Concurrent cancel 2' });

      const [res1, res2] = await Promise.all([cancel1, cancel2]);
      const statuses = [res1.status, res2.status];

      expect(statuses).toContain(200);
      expect(statuses).toContain(400);

      const failedRes = res1.status === 400 ? res1 : res2;
      expect(failedRes.body.error.code).toBe('BOOKING_ALREADY_CANCELLED');
    });
  });
});
