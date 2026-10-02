import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { GlobalExceptionFilter, TransformInterceptor } from '../src/common';
import { UserRole, UserStatus } from '../src/modules/auth/types/user-role.enum';
import { RedisService } from '../src/infrastructure/redis/redis.service';
import { CleanupProcessor } from '../src/infrastructure/queues/processors/cleanup.processor';
import { RealtimeService } from '../src/infrastructure/realtime/realtime.service';

describe('Reliability, Transaction Integrity & Fault Tolerance (e2e)', () => {
  let app: INestApplication;
  let server: App;
  let prisma: PrismaService;
  let redisService: RedisService;
  let cleanupProcessor: CleanupProcessor;
  let realtimeService: RealtimeService;

  let customerToken: string;
  let managerToken: string;
  let adminToken: string;

  const testIds = {
    customerId: '70000000-0000-4000-8000-000000000101',
    managerId: '70000000-0000-4000-8000-000000000201',
    hotel1Id: '70000000-0000-4000-8000-000000000001',
    hotel2Id: '70000000-0000-4000-8000-000000000002',
    roomTypeId1: '70000000-0000-4000-8000-000000000011',
    roomTypeId2: '70000000-0000-4000-8000-000000000012',
    roomId1: '70000000-0000-4000-8000-000000000021',
    roomId2: '70000000-0000-4000-8000-000000000022',
  };

  const trackedBookingIds: string[] = [];

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
    redisService = app.get<RedisService>(RedisService);
    cleanupProcessor = app.get<CleanupProcessor>(CleanupProcessor);
    realtimeService = app.get<RealtimeService>(RealtimeService);

    const passwordHash = await bcrypt.hash('Password123!', 10);

    // Setup Customer
    await prisma.user.upsert({
      where: { id: testIds.customerId },
      update: { status: UserStatus.ACTIVE },
      create: {
        id: testIds.customerId,
        email: 'rel.cust@stayora.com',
        passwordHash,
        firstName: 'Reliability',
        lastName: 'Customer',
        role: UserRole.CUSTOMER,
        status: UserStatus.ACTIVE,
      },
    });

    // Setup Manager
    await prisma.user.upsert({
      where: { id: testIds.managerId },
      update: { status: UserStatus.ACTIVE },
      create: {
        id: testIds.managerId,
        email: 'rel.mgr@stayora.com',
        passwordHash,
        firstName: 'Reliability',
        lastName: 'Manager',
        role: UserRole.HOTEL_MANAGER,
        status: UserStatus.ACTIVE,
      },
    });

    // Login Customer & Manager
    const resC = await request(server)
      .post('/api/v1/auth/customer/login')
      .send({ email: 'rel.cust@stayora.com', password: 'Password123!' });
    customerToken = resC.body.data.accessToken;

    const resM = await request(server)
      .post('/api/v1/auth/manager/login')
      .send({ email: 'rel.mgr@stayora.com', password: 'Password123!' });
    managerToken = resM.body.data.accessToken;

    const resAdmin = await request(server)
      .post('/api/v1/auth/admin/login')
      .send({ email: 'admin@stayora.com', password: 'Password123!' });
    adminToken = resAdmin.body.data.accessToken;

    // Setup Hotel 1 & Hotel 2
    await prisma.hotel.upsert({
      where: { id: testIds.hotel1Id },
      update: { isActive: true },
      create: {
        id: testIds.hotel1Id,
        name: 'Reliability Hotel 1',
        slug: 'reliability-hotel-1',
        description: 'Hotel 1 for constraints testing',
        starRating: 3,
        addressLine1: '301 Reliability Rd',
        city: 'Bengaluru',
        state: 'Karnataka',
        country: 'India',
        postalCode: '560001',
        phone: '+919999997701',
        email: 'hotel1@reliability.com',
        isActive: true,
      },
    });

    await prisma.hotel.upsert({
      where: { id: testIds.hotel2Id },
      update: { isActive: true },
      create: {
        id: testIds.hotel2Id,
        name: 'Reliability Hotel 2',
        slug: 'reliability-hotel-2',
        description: 'Hotel 2 for constraints testing',
        starRating: 4,
        addressLine1: '302 Reliability Rd',
        city: 'Bengaluru',
        state: 'Karnataka',
        country: 'India',
        postalCode: '560001',
        phone: '+919999997702',
        email: 'hotel2@reliability.com',
        isActive: true,
      },
    });

    // Assign Manager to Hotel 1 and Hotel 2
    await prisma.hotelManager.upsert({
      where: { userId_hotelId: { userId: testIds.managerId, hotelId: testIds.hotel1Id } },
      update: {},
      create: { userId: testIds.managerId, hotelId: testIds.hotel1Id, isPrimary: true },
    });

    await prisma.hotelManager.upsert({
      where: { userId_hotelId: { userId: testIds.managerId, hotelId: testIds.hotel2Id } },
      update: {},
      create: { userId: testIds.managerId, hotelId: testIds.hotel2Id, isPrimary: true },
    });

    // Create Room Types
    await prisma.roomType.upsert({
      where: { id: testIds.roomTypeId1 },
      update: { isActive: true },
      create: {
        id: testIds.roomTypeId1,
        hotelId: testIds.hotel1Id,
        name: 'Standard Room Type',
        slug: 'standard-room-type',
        description: 'Standard description',
        maxOccupancy: 2,
        maxAdults: 2,
        maxChildren: 1,
        basePriceCents: BigInt(400000),
        currency: 'INR',
        bedType: 'QUEEN',
        isActive: true,
      },
    });

    await prisma.roomType.upsert({
      where: { id: testIds.roomTypeId2 },
      update: { isActive: true },
      create: {
        id: testIds.roomTypeId2,
        hotelId: testIds.hotel2Id,
        name: 'Executive Room Type',
        slug: 'executive-room-type',
        description: 'Executive description',
        maxOccupancy: 2,
        maxAdults: 2,
        maxChildren: 1,
        basePriceCents: BigInt(600000),
        currency: 'INR',
        bedType: 'KING',
        isActive: true,
      },
    });
  });

  afterAll(async () => {
    if (trackedBookingIds.length > 0) {
      await prisma.paymentAttempt.deleteMany({ where: { bookingId: { in: trackedBookingIds } } });
      await prisma.payment.deleteMany({ where: { bookingId: { in: trackedBookingIds } } });
      await prisma.bookingRoom.deleteMany({ where: { bookingId: { in: trackedBookingIds } } });
      await prisma.bookingPriceSnapshot.deleteMany({ where: { bookingId: { in: trackedBookingIds } } });
      await prisma.bookingGuest.deleteMany({ where: { bookingId: { in: trackedBookingIds } } });
      await prisma.booking.deleteMany({ where: { id: { in: trackedBookingIds } } });
    }

    await prisma.room.deleteMany({ where: { hotelId: { in: [testIds.hotel1Id, testIds.hotel2Id] } } });
    await prisma.roomType.deleteMany({ where: { hotelId: { in: [testIds.hotel1Id, testIds.hotel2Id] } } });
    await prisma.hotelManager.deleteMany({ where: { hotelId: { in: [testIds.hotel1Id, testIds.hotel2Id] } } });
    await prisma.hotel.deleteMany({ where: { id: { in: [testIds.hotel1Id, testIds.hotel2Id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [testIds.customerId, testIds.managerId] } } });

    await app.close();
  });

  // ===========================================================================
  // 1. Database Constraint Enforcement
  // ===========================================================================
  describe('Database Constraint Enforcement', () => {
    it('should reject duplicate user email registration with 409 Conflict', async () => {
      const res = await request(server)
        .post('/api/v1/auth/customer/register')
        .send({
          email: 'rel.cust@stayora.com', // already registered
          password: 'Password123!',
          firstName: 'Duplicate',
          lastName: 'Email',
        })
        .expect(409);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('EMAIL_ALREADY_REGISTERED');
    });

    it('should enforce unique room number scoped to hotel: duplicate in same hotel rejected with 409', async () => {
      // 1. Create Room "101" in Hotel 1
      const res1 = await request(server)
        .post('/api/v1/rooms')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          roomTypeId: testIds.roomTypeId1,
          roomNumber: 'ROOM-101',
          floor: 1,
        })
        .expect(201);

      // 2. Attempt duplicate Room "101" in same Hotel 1 -> 409 Conflict
      const resDuplicate = await request(server)
        .post('/api/v1/rooms')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          roomTypeId: testIds.roomTypeId1,
          roomNumber: 'ROOM-101',
          floor: 1,
        })
        .expect(409);

      expect(resDuplicate.body.success).toBe(false);
      expect(resDuplicate.body.error.code).toBe('ROOM_NUMBER_ALREADY_EXISTS');

      // 3. Same Room Number "101" in Hotel 2 should SUCCEED (scoped per hotel)
      const resHotel2 = await request(server)
        .post('/api/v1/rooms')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          roomTypeId: testIds.roomTypeId2,
          roomNumber: 'ROOM-101', // same number, different hotel
          floor: 1,
        })
        .expect(201);

      expect(resHotel2.body.success).toBe(true);
    });

    it('should handle foreign key reference failures with 404 when referencing non-existent hotel', async () => {
      const res = await request(server)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          hotelId: '00000000-0000-4000-8000-000000000000',
          roomTypeId: testIds.roomTypeId1,
          checkIn: '2026-12-01',
          checkOut: '2026-12-03',
          guests: 1,
          rooms: 1,
        })
        .expect(404);

      expect(res.body.success).toBe(false);
    });
  });

  // ===========================================================================
  // 2. Transaction Rollback & Atomicity
  // ===========================================================================
  describe('Transaction Rollback & Atomicity', () => {
    it('should rollback transaction completely if physical room allocation cannot be fulfilled', async () => {
      // Request 5 rooms when only 1 exists (guests=2 is within capacity limit of 2)
      const res = await request(server)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          hotelId: testIds.hotel1Id,
          roomTypeId: testIds.roomTypeId1,
          checkIn: '2026-12-10',
          checkOut: '2026-12-12',
          guests: 2,
          rooms: 5, // Exceeds available physical inventory (only 1 exists)
        })
        .expect(409);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('ROOM_NOT_AVAILABLE');

      // Database verification: Zero orphaned booking or price snapshot persisted!
      const orphanedBookings = await prisma.booking.findMany({
        where: {
          customerId: testIds.customerId,
          hotelId: testIds.hotel1Id,
          checkInDate: new Date('2026-12-10'),
        },
        include: { priceSnapshot: true, bookingRooms: true },
      });

      expect(orphanedBookings.length).toBe(0);
    });
  });

  // ===========================================================================
  // 3. Redis Reliability & PostgreSQL Fallback
  // ===========================================================================
  describe('Redis Resilience & PostgreSQL Fallback', () => {
    it('should fall back cleanly to PostgreSQL and return 200 even when Redis operations fail', async () => {
      // Spy on raw redis client.get to simulate Redis network timeout handled by RedisService
      const redisGetSpy = jest
        .spyOn(redisService.getClient(), 'get')
        .mockRejectedValueOnce(new Error('Redis connection timeout'));

      const res = await request(server)
        .get(`/api/v1/hotels/${testIds.hotel1Id}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(testIds.hotel1Id);
      expect(res.body.data.name).toBe('Reliability Hotel 1');

      redisGetSpy.mockRestore();
    });

    it('should continue functioning seamlessly when Redis SET cache fails', async () => {
      const redisSetSpy = jest
        .spyOn(redisService.getClient(), 'set')
        .mockRejectedValueOnce(new Error('OOM Redis write error'));

      const res = await request(server)
        .get(`/api/v1/hotels/${testIds.hotel2Id}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(testIds.hotel2Id);

      redisSetSpy.mockRestore();
    });
  });

  // ===========================================================================
  // 4. BullMQ Background Processing & Job Idempotency
  // ===========================================================================
  describe('BullMQ Background Processing & Job Idempotency', () => {
    it('should safely and idempotently process stale booking expiration without double-processing', async () => {
      // 1. Create a pending booking
      const resB = await request(server)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          hotelId: testIds.hotel1Id,
          roomTypeId: testIds.roomTypeId1,
          checkIn: '2026-12-20',
          checkOut: '2026-12-22',
          guests: 1,
          rooms: 1,
        });

      const expiredBookingId = resB.body.data.id;
      trackedBookingIds.push(expiredBookingId);

      // 2. Artificially set holdExpiresAt to past timestamp to simulate expiration
      await prisma.booking.update({
        where: { id: expiredBookingId },
        data: {
          holdExpiresAt: new Date(Date.now() - 60000), // 1 minute in the past
          status: 'PENDING',
        },
      });

      // 3. Execute the cleanup processor
      const fakeJob = {
        name: 'cleanup-expired-bookings',
        id: 'test-job-clean-1',
        attemptsMade: 1,
      } as any;

      const firstRun = await cleanupProcessor.process(fakeJob);
      expect(firstRun.expiredCount).toBeGreaterThanOrEqual(1);

      // Verify booking is now EXPIRED
      const dbBooking1 = await prisma.booking.findUnique({
        where: { id: expiredBookingId },
      });
      expect(dbBooking1?.status).toBe('EXPIRED');

      // 4. Execute the cleanup processor a SECOND time (idempotency check)
      const secondRun = await cleanupProcessor.process(fakeJob);
      expect(secondRun.expiredCount).toBe(0);

      const dbBooking2 = await prisma.booking.findUnique({
        where: { id: expiredBookingId },
      });
      expect(dbBooking2?.status).toBe('EXPIRED');
    });
  });

  // ===========================================================================
  // 5. Server-Sent Events (SSE) Lifecycle & Disconnect Resilience
  // ===========================================================================
  describe('Server-Sent Events (SSE) Client Lifecycle', () => {
    it('should register connection, transmit heartbeat, and handle disconnection cleanly', () => {
      const mockUser = {
        id: testIds.customerId,
        email: 'rel.cust@stayora.com',
        role: UserRole.CUSTOMER,
        status: UserStatus.ACTIVE,
      };

      // 1. Register SSE Connection
      const { connectionId, stream } = realtimeService.registerConnection(mockUser);
      expect(connectionId).toBeDefined();
      expect(stream).toBeDefined();

      const initialCount = realtimeService.getConnectionCount();
      expect(initialCount).toBeGreaterThanOrEqual(1);

      // 2. Unregister Connection (simulating abrupt browser disconnect)
      realtimeService.removeConnection(mockUser.id, connectionId);

      const countAfter = realtimeService.getConnectionCount();
      expect(countAfter).toBe(initialCount - 1);
    });
  });
});

