import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { GlobalExceptionFilter, TransformInterceptor } from '../src/common';
import { BookingStatus } from '../src/modules/bookings/types/booking-status.enum';

describe('Booking Engine (e2e)', () => {
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
  const customerBUserId = '66666666-6666-4666-8666-999999999999';
  const managerBUserId = '77777777-7777-4777-8777-999999999999';
  const hotelCId = '88888888-8888-4888-8888-999999999999';

  let mumbaiClassicRoomTypeId: string;
  let mumbaiSuiteRoomTypeId: string;
  let goaRoomTypeId: string;

  // Dedicated concurrency test entities
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

    // 1. Obtain Customer A, Manager A, Admin tokens
    const customerALogin = await request(server)
      .post('/api/v1/auth/customer/login')
      .send({ email: 'customer@stayora.com', password: 'Password123!' });
    customerAToken = customerALogin.body.data.accessToken;

    const managerALogin = await request(server)
      .post('/api/v1/auth/manager/login')
      .send({ email: 'manager@stayora.com', password: 'Password123!' });
    managerAToken = managerALogin.body.data.accessToken;

    const adminLogin = await request(server)
      .post('/api/v1/auth/admin/login')
      .send({ email: 'admin@stayora.com', password: 'Password123!' });
    adminToken = adminLogin.body.data.accessToken;

    // 2. Create and login Customer B
    await prisma.user.upsert({
      where: { id: customerBUserId },
      update: {},
      create: {
        id: customerBUserId,
        email: 'customer.bookings.test@stayora.com',
        passwordHash,
        firstName: 'Bhavna',
        lastName: 'Patel',
        role: 'CUSTOMER',
        status: 'ACTIVE',
      },
    });

    const customerBLogin = await request(server)
      .post('/api/v1/auth/customer/login')
      .send({ email: 'customer.bookings.test@stayora.com', password: 'Password123!' });
    customerBToken = customerBLogin.body.data.accessToken;

    // 3. Create Manager B assigned only to Hotel C (Manali)
    await prisma.hotel.upsert({
      where: { id: hotelCId },
      update: {},
      create: {
        id: hotelCId,
        name: 'Stayora Himalayan Retreat Bookings',
        slug: 'stayora-bookings-retreat-isolated',
        description: 'Alpine retreat in Manali.',
        starRating: 4,
        addressLine1: 'Solang Valley',
        city: 'Manali',
        state: 'Himachal Pradesh',
        country: 'India',
        postalCode: '175103',
        phone: '+911902255111',
        email: 'himalayan.bookings.test@stayora.com',
        isActive: true,
      },
    });

    await prisma.user.upsert({
      where: { id: managerBUserId },
      update: {},
      create: {
        id: managerBUserId,
        email: 'manager.bookings.test@stayora.com',
        passwordHash,
        firstName: 'Bravo',
        lastName: 'Manager',
        role: 'HOTEL_MANAGER',
        status: 'ACTIVE',
      },
    });

    await prisma.hotelManager.upsert({
      where: {
        userId_hotelId: {
          userId: managerBUserId,
          hotelId: hotelCId,
        },
      },
      update: {},
      create: {
        userId: managerBUserId,
        hotelId: hotelCId,
        isPrimary: true,
      },
    });

    const managerBLogin = await request(server)
      .post('/api/v1/auth/manager/login')
      .send({ email: 'manager.bookings.test@stayora.com', password: 'Password123!' });
    managerBToken = managerBLogin.body.data.accessToken;

    // 4. Retrieve Room Types
    const classicRoom = await prisma.roomType.findFirst({
      where: { hotelId: HOTEL_MUMBAI_ID, slug: 'classic-heritage-room' },
    });
    mumbaiClassicRoomTypeId = classicRoom!.id;

    const suiteRoom = await prisma.roomType.findFirst({
      where: { hotelId: HOTEL_MUMBAI_ID, slug: 'palace-sea-view-suite' },
    });
    mumbaiSuiteRoomTypeId = suiteRoom!.id;

    const goaRoom = await prisma.roomType.findFirst({
      where: { hotelId: HOTEL_GOA_ID },
    });
    goaRoomTypeId = goaRoom!.id;

    // 5. Create a dedicated 1-room category for concurrency test
    const concRt = await prisma.roomType.create({
      data: {
        hotelId: hotelCId,
        name: 'Single Unit Concurrency Category',
        slug: 'single-unit-concurrency-category',
        description: 'Created exclusively for race condition verification.',
        maxOccupancy: 2,
        basePriceCents: BigInt(500000),
        currency: 'INR',
        bedType: 'QUEEN',
        isActive: true,
      },
    });
    concurrencyRoomTypeId = concRt.id;

    const concRoom = await prisma.room.create({
      data: {
        hotelId: hotelCId,
        roomTypeId: concurrencyRoomTypeId,
        roomNumber: 'CONC-101',
        floor: 10,
        operationalStatus: 'AVAILABLE',
      },
    });
    concurrencyRoomId = concRoom.id;
  });

  afterAll(async () => {
    // 1. Delete all bookings created during tests
    if (createdBookingIds.length > 0) {
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

    // 2. Delete test concurrency room and room type
    if (concurrencyRoomId) {
      await prisma.bookingRoom.deleteMany({
        where: { roomId: concurrencyRoomId },
      });
      await prisma.room.deleteMany({
        where: { id: concurrencyRoomId },
      });
    }
    if (concurrencyRoomTypeId) {
      await prisma.roomType.deleteMany({
        where: { id: concurrencyRoomTypeId },
      });
    }

    // 3. Delete Hotel C and Manager B
    await prisma.hotelManager.deleteMany({ where: { hotelId: hotelCId } });
    await prisma.hotel.deleteMany({ where: { id: hotelCId } });
    await prisma.user.deleteMany({ where: { id: managerBUserId } });
    await prisma.user.deleteMany({ where: { id: customerBUserId } });

    await app.close();
  });

  // ===========================================================================
  // 1. Validation & Input Integrity
  // ===========================================================================
  describe('Input & Date Validation', () => {
    it('should reject unauthenticated booking request (401 Unauthorized)', async () => {
      await request(server)
        .post('/api/v1/bookings')
        .send({
          hotelId: HOTEL_MUMBAI_ID,
          roomTypeId: mumbaiClassicRoomTypeId,
          checkIn: '2026-11-01',
          checkOut: '2026-11-03',
          guests: 2,
        })
        .expect(401);
    });

    it('should reject non-customer roles from creating bookings (403 Forbidden)', async () => {
      await request(server)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${managerAToken}`)
        .send({
          hotelId: HOTEL_MUMBAI_ID,
          roomTypeId: mumbaiClassicRoomTypeId,
          checkIn: '2026-11-01',
          checkOut: '2026-11-03',
          guests: 2,
        })
        .expect(403);
    });

    it('should reject malformed UUIDs (400 Bad Request)', async () => {
      const res = await request(server)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          hotelId: 'not-a-uuid',
          roomTypeId: mumbaiClassicRoomTypeId,
          checkIn: '2026-11-01',
          checkOut: '2026-11-03',
          guests: 2,
        })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('should reject checkOut <= checkIn (400 Bad Request)', async () => {
      const res = await request(server)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          hotelId: HOTEL_MUMBAI_ID,
          roomTypeId: mumbaiClassicRoomTypeId,
          checkIn: '2026-11-05',
          checkOut: '2026-11-02',
          guests: 2,
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('checkOut date must be strictly after checkIn date');
    });

    it('should reject past check-in dates (400 Bad Request)', async () => {
      const res = await request(server)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          hotelId: HOTEL_MUMBAI_ID,
          roomTypeId: mumbaiClassicRoomTypeId,
          checkIn: '2020-01-01',
          checkOut: '2020-01-03',
          guests: 2,
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('checkIn date cannot be in the past');
    });

    it('should reject guest count < 1 (400 Bad Request)', async () => {
      const res = await request(server)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          hotelId: HOTEL_MUMBAI_ID,
          roomTypeId: mumbaiClassicRoomTypeId,
          checkIn: '2026-11-01',
          checkOut: '2026-11-03',
          guests: 0,
        })
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  // ===========================================================================
  // 2. Domain Relationship & Capacity Validation
  // ===========================================================================
  describe('Domain Relationship & Capacity Checks', () => {
    it('should reject non-existent hotel property (404 Not Found)', async () => {
      const res = await request(server)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          hotelId: '00000000-0000-4000-8000-000000000000',
          roomTypeId: mumbaiClassicRoomTypeId,
          checkIn: '2026-11-01',
          checkOut: '2026-11-03',
          guests: 2,
        })
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('HOTEL_NOT_FOUND');
    });

    it('should reject cross-hotel mismatch (RoomType belongs to Goa, request specifies Mumbai) (400 Bad Request)', async () => {
      const res = await request(server)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          hotelId: HOTEL_MUMBAI_ID,
          roomTypeId: goaRoomTypeId, // Belong to Goa!
          checkIn: '2026-11-01',
          checkOut: '2026-11-03',
          guests: 2,
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('HOTEL_ROOM_TYPE_MISMATCH');
    });

    it('should reject booking when guests exceed room category capacity (400 Bad Request)', async () => {
      // Classic Heritage Room has maxOccupancy = 2
      const res = await request(server)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          hotelId: HOTEL_MUMBAI_ID,
          roomTypeId: mumbaiClassicRoomTypeId,
          checkIn: '2026-11-01',
          checkOut: '2026-11-03',
          guests: 5, // Exceeds capacity 2
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CAPACITY_EXCEEDED');
    });
  });

  // ===========================================================================
  // 3. Transactional Booking Creation & Inventory Allocation
  // ===========================================================================
  describe('Transactional Booking Creation', () => {
    let booking1Id: string;

    it('should successfully create booking and automatically allocate available physical room', async () => {
      const res = await request(server)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          hotelId: HOTEL_MUMBAI_ID,
          roomTypeId: mumbaiSuiteRoomTypeId,
          checkIn: '2026-11-10',
          checkOut: '2026-11-13',
          guests: 2,
          rooms: 1,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      const data = res.body.data;
      expect(data.id).toBeDefined();
      booking1Id = data.id;
      createdBookingIds.push(booking1Id);

      expect(data.bookingReference).toMatch(/^STY-\d{6}-[A-Z0-9]+$/);
      expect(data.status).toBe(BookingStatus.PENDING);
      expect(data.totalNights).toBe(3);
      expect(data.totalGuests).toBe(2);
      expect(data.roomsCount).toBe(1);

      // Price snapshot verification: ₹8,500.00 * 3 nights = ₹25,500.00
      expect(data.totalAmount).toBe('25500.00');
      expect(data.totalAmountCents).toBe('2550000');
      expect(data.priceSnapshot).toBeDefined();
      expect(data.priceSnapshot.grossAmount).toBe('25500.00');

      // Allocation verification
      expect(data.allocatedRooms.length).toBe(1);
      expect(data.allocatedRooms[0].roomNumber).toBeDefined();

      // Database verification
      const dbBooking = await prisma.booking.findUnique({
        where: { id: booking1Id },
        include: { bookingRooms: true, priceSnapshot: true },
      });
      expect(dbBooking).not.toBeNull();
      expect(dbBooking?.bookingRooms.length).toBe(1);
      expect(dbBooking?.bookingRooms[0].status).toBe('RESERVED');
    });

    it('should allocate multiple physical rooms when rooms = 2', async () => {
      const res = await request(server)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          hotelId: HOTEL_MUMBAI_ID,
          roomTypeId: mumbaiSuiteRoomTypeId,
          checkIn: '2026-11-20',
          checkOut: '2026-11-22',
          guests: 2,
          rooms: 2,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      const data = res.body.data;
      createdBookingIds.push(data.id);

      expect(data.roomsCount).toBe(2);
      expect(data.allocatedRooms.length).toBe(2);
      // Different physical rooms allocated
      expect(data.allocatedRooms[0].id).not.toBe(data.allocatedRooms[1].id);
    });

    it('should reject booking if requested rooms exceed available inventory (409 Conflict)', async () => {
      // Mumbai Suite has 3 total rooms. Requesting 10 rooms must fail!
      const res = await request(server)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          hotelId: HOTEL_MUMBAI_ID,
          roomTypeId: mumbaiSuiteRoomTypeId,
          checkIn: '2026-11-20',
          checkOut: '2026-11-22',
          guests: 2,
          rooms: 10,
        })
        .expect(409);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('ROOM_NOT_AVAILABLE');
    });
  });

  // ===========================================================================
  // 4. Role-Scoped Retrieval & IDOR Protection
  // ===========================================================================
  describe('Role-Scoped Booking Retrieval & IDOR Defense', () => {
    let customerABookingId: string;

    beforeAll(async () => {
      const res = await request(server)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          hotelId: HOTEL_MUMBAI_ID,
          roomTypeId: mumbaiSuiteRoomTypeId,
          checkIn: '2026-11-25',
          checkOut: '2026-11-28',
          guests: 2,
          rooms: 1,
        });
      customerABookingId = res.body.data.id;
      createdBookingIds.push(customerABookingId);
    });

    it('Customer A can retrieve their own booking', async () => {
      const res = await request(server)
        .get(`/api/v1/bookings/${customerABookingId}`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(customerABookingId);
    });

    it('Customer B CANNOT view Customer A booking (404 Not Found - IDOR defense)', async () => {
      const res = await request(server)
        .get(`/api/v1/bookings/${customerABookingId}`)
        .set('Authorization', `Bearer ${customerBToken}`)
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BOOKING_NOT_FOUND');
    });

    it('Customer A list endpoint returns only Customer A bookings', async () => {
      const res = await request(server)
        .get('/api/v1/bookings')
        .set('Authorization', `Bearer ${customerAToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(
        res.body.data.items.some((item: any) => item.id === customerABookingId),
      ).toBe(true);

      // Customer B should NOT see Customer A's booking in their list
      const resB = await request(server)
        .get('/api/v1/bookings')
        .set('Authorization', `Bearer ${customerBToken}`)
        .expect(200);

      expect(
        resB.body.data.items.some((item: any) => item.id === customerABookingId),
      ).toBe(false);
    });

    it('Manager A (assigned to Mumbai) can view Customer A Mumbai booking', async () => {
      const res = await request(server)
        .get(`/api/v1/bookings/${customerABookingId}`)
        .set('Authorization', `Bearer ${managerAToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(customerABookingId);
    });

    it('Manager B (assigned to Manali) CANNOT view Mumbai booking (404 Not Found)', async () => {
      const res = await request(server)
        .get(`/api/v1/bookings/${customerABookingId}`)
        .set('Authorization', `Bearer ${managerBToken}`)
        .expect(404);

      expect(res.body.success).toBe(false);
    });

    it('Admin can view any booking across properties', async () => {
      const res = await request(server)
        .get(`/api/v1/bookings/${customerABookingId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(customerABookingId);
    });
  });

  // ===========================================================================
  // 5. Cancellation Lifecycle & Atomic Inventory Release
  // ===========================================================================
  describe('Cancellation Lifecycle & Inventory Release', () => {
    let cancelBookingId: string;

    beforeAll(async () => {
      const res = await request(server)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          hotelId: HOTEL_MUMBAI_ID,
          roomTypeId: mumbaiSuiteRoomTypeId,
          checkIn: '2026-12-01',
          checkOut: '2026-12-05',
          guests: 2,
          rooms: 1,
        });
      cancelBookingId = res.body.data.id;
      createdBookingIds.push(cancelBookingId);
    });

    it('Customer should be able to cancel their active reservation', async () => {
      const res = await request(server)
        .patch(`/api/v1/bookings/${cancelBookingId}/cancel`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ reason: 'Trip rescheduled' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe(BookingStatus.CANCELLED);
      expect(res.body.data.cancelledAt).toBeDefined();
      expect(res.body.data.cancellationReason).toBe('Trip rescheduled');

      // Verify allocated room was released in database
      const dbRooms = await prisma.bookingRoom.findMany({
        where: { bookingId: cancelBookingId },
      });
      for (const br of dbRooms) {
        expect(br.status).toBe('CANCELLED');
      }
    });

    it('should reject cancelling an already cancelled reservation (400 Bad Request)', async () => {
      const res = await request(server)
        .patch(`/api/v1/bookings/${cancelBookingId}/cancel`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ reason: 'Second cancel attempt' })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BOOKING_ALREADY_CANCELLED');
    });
  });

  // ===========================================================================
  // 6. State Machine Transitions (Manager / Admin)
  // ===========================================================================
  describe('State Machine Transitions', () => {
    let stateBookingId: string;

    beforeAll(async () => {
      const res = await request(server)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          hotelId: HOTEL_MUMBAI_ID,
          roomTypeId: mumbaiSuiteRoomTypeId,
          checkIn: '2026-12-10',
          checkOut: '2026-12-14',
          guests: 2,
          rooms: 1,
        });
      stateBookingId = res.body.data.id;
      createdBookingIds.push(stateBookingId);
    });

    it('should reject invalid transition (PENDING -> CHECKED_OUT) (400 Bad Request)', async () => {
      const res = await request(server)
        .patch(`/api/v1/bookings/${stateBookingId}/status`)
        .set('Authorization', `Bearer ${managerAToken}`)
        .send({ status: BookingStatus.CHECKED_OUT })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_STATE_TRANSITION');
    });

    it('should transition PENDING -> CONFIRMED', async () => {
      const res = await request(server)
        .patch(`/api/v1/bookings/${stateBookingId}/status`)
        .set('Authorization', `Bearer ${managerAToken}`)
        .send({ status: BookingStatus.CONFIRMED })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe(BookingStatus.CONFIRMED);
    });

    it('should transition CONFIRMED -> CHECKED_IN and mark room OCCUPIED', async () => {
      const res = await request(server)
        .patch(`/api/v1/bookings/${stateBookingId}/status`)
        .set('Authorization', `Bearer ${managerAToken}`)
        .send({ status: BookingStatus.CHECKED_IN })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe(BookingStatus.CHECKED_IN);
      expect(res.body.data.checkedInAt).toBeDefined();

      const dbRooms = await prisma.bookingRoom.findMany({
        where: { bookingId: stateBookingId },
      });
      expect(dbRooms[0].status).toBe('OCCUPIED');
    });

    it('should transition CHECKED_IN -> CHECKED_OUT and mark room RELEASED', async () => {
      const res = await request(server)
        .patch(`/api/v1/bookings/${stateBookingId}/status`)
        .set('Authorization', `Bearer ${managerAToken}`)
        .send({ status: BookingStatus.CHECKED_OUT })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe(BookingStatus.CHECKED_OUT);
      expect(res.body.data.checkedOutAt).toBeDefined();

      const dbRooms = await prisma.bookingRoom.findMany({
        where: { bookingId: stateBookingId },
      });
      expect(dbRooms[0].status).toBe('RELEASED');
    });
  });

  // ===========================================================================
  // 7. Concurrency & Race Condition Defense (Mandatory)
  // Single physical room with 3 simultaneous booking attempts for overlapping dates.
  // Exactly ONE attempt MUST succeed (201).
  // Remaining attempts MUST fail (409 Conflict - ROOM_NOT_AVAILABLE).
  // ===========================================================================
  describe('Concurrency & Double-Booking Prevention', () => {
    it('should prevent double-booking under simultaneous concurrent requests for 1 physical room', async () => {
      const checkIn = '2026-12-20';
      const checkOut = '2026-12-25';

      // Launch 3 simultaneous concurrent booking requests for the exact same room category and dates
      const bookingPayload = {
        hotelId: hotelCId,
        roomTypeId: concurrencyRoomTypeId,
        checkIn,
        checkOut,
        guests: 2,
        rooms: 1,
      };

      const [res1, res2, res3] = await Promise.all([
        request(server)
          .post('/api/v1/bookings')
          .set('Authorization', `Bearer ${customerAToken}`)
          .send(bookingPayload),
        request(server)
          .post('/api/v1/bookings')
          .set('Authorization', `Bearer ${customerBToken}`)
          .send(bookingPayload),
        request(server)
          .post('/api/v1/bookings')
          .set('Authorization', `Bearer ${customerAToken}`)
          .send(bookingPayload),
      ]);

      const responses = [res1, res2, res3];
      const statuses = responses.map((r) => r.status);

      // Exactly ONE request must succeed with 201 Created
      const successfulResponses = responses.filter((r) => r.status === 201);
      const conflictResponses = responses.filter((r) => r.status === 409);

      expect(successfulResponses.length).toBe(1);
      expect(conflictResponses.length).toBe(2);

      // Track created booking for teardown
      const successfulBooking = successfulResponses[0].body.data;
      createdBookingIds.push(successfulBooking.id);

      // Verify conflict responses have ROOM_NOT_AVAILABLE error code
      for (const cr of conflictResponses) {
        expect(cr.body.success).toBe(false);
        expect(cr.body.error.code).toBe('ROOM_NOT_AVAILABLE');
      }

      // Authoritative Database Invariant Check:
      // Exactly ONE active allocation can exist for this physical room and date range in PostgreSQL!
      const activeAllocations = await prisma.bookingRoom.findMany({
        where: {
          roomId: concurrencyRoomId,
          status: { in: ['RESERVED', 'OCCUPIED'] },
        },
      });

      expect(activeAllocations.length).toBe(1);
      expect(activeAllocations[0].bookingId).toBe(successfulBooking.id);
    });
  });
});
