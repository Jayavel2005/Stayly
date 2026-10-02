import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { QueueService } from '../src/infrastructure/queues/queue.service';
import { QUEUE_NAMES } from '../src/infrastructure/queues/queue.constants';
import {
  NotificationJobName,
  CleanupJobName,
} from '../src/infrastructure/queues/queue.types';
import { PrismaService } from '../src/prisma/prisma.service';
import { BookingStatus, BookingRoomStatus } from '../src/modules/bookings/types/booking-status.enum';
import { GlobalExceptionFilter, TransformInterceptor } from '../src/common';

describe('BullMQ Background Jobs & Asynchronous Processing (e2e)', () => {
  let app: INestApplication;
  let server: App;
  let queueService: QueueService;
  let prisma: PrismaService;

  let customerToken: string;
  let customerId: string;
  let hotelId: string;
  let roomTypeId: string;
  let roomId: string;

  const testIdsToClean: {
    notifications: string[];
    bookings: string[];
  } = {
    notifications: [],
    bookings: [],
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
    queueService = app.get<QueueService>(QueueService);
    prisma = app.get<PrismaService>(PrismaService);

    // Authenticate test customer
    const loginRes = await request(server)
      .post('/api/v1/auth/customer/login')
      .send({ email: 'customer@stayora.com', password: 'Password123!' });
    customerToken = loginRes.body.data.accessToken;
    customerId = loginRes.body.data.user.id;

    // Fetch seeded hotel, room type, and physical room
    const hotel = await prisma.hotel.findFirst({
      where: { slug: 'stayora-grand-palace' },
      include: {
        roomTypes: {
          include: { rooms: true },
        },
      },
    });

    if (!hotel || !hotel.roomTypes[0] || !hotel.roomTypes[0].rooms[0]) {
      throw new Error('Seeded hotel hierarchy required for tests');
    }

    hotelId = hotel.id;
    roomTypeId = hotel.roomTypes[0].id;
    roomId = hotel.roomTypes[0].rooms[0].id;
  });

  afterAll(async () => {
    // Clean up created notifications
    if (testIdsToClean.notifications.length > 0) {
      await prisma.notification.deleteMany({
        where: { id: { in: testIdsToClean.notifications } },
      });
    }

    // Clean up created bookings
    if (testIdsToClean.bookings.length > 0) {
      await prisma.review.deleteMany({ where: { bookingId: { in: testIdsToClean.bookings } } });
      await prisma.paymentAttempt.deleteMany({ where: { bookingId: { in: testIdsToClean.bookings } } });
      await prisma.payment.deleteMany({ where: { bookingId: { in: testIdsToClean.bookings } } });
      await prisma.bookingRoom.deleteMany({ where: { bookingId: { in: testIdsToClean.bookings } } });
      await prisma.bookingPriceSnapshot.deleteMany({ where: { bookingId: { in: testIdsToClean.bookings } } });
      await prisma.auditLog.deleteMany({ where: { entityId: { in: testIdsToClean.bookings } } });
      await prisma.booking.deleteMany({ where: { id: { in: testIdsToClean.bookings } } });
    }

    await app.close();
  });

  describe('Health Check Integration', () => {
    it('GET /api/v1/health should include BullMQ queues status as up', async () => {
      const response = await request(server).get('/api/v1/health').expect(200);

      expect(response.body).toEqual({
        success: true,
        data: expect.objectContaining({
          status: 'ok',
          service: 'stayora-api',
          services: {
            database: 'up',
            redis: 'up',
            queues: 'up',
          },
        }),
      });
    });
  });

  async function waitForJob(job: any, maxWaitMs = 5000): Promise<void> {
    if (!job) return;
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      try {
        const state = await job.getState();
        if (state === 'completed' || state === 'failed') return;
      } catch {
        return;
      }
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  describe('Booking Creation -> Background Notification Processing', () => {
    it('should create booking synchronously and process notification asynchronously via worker', async () => {
      // 1. Create booking (Synchronous DB operation)
      const res = await request(server)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          hotelId,
          roomTypeId,
          checkIn: '2026-12-01',
          checkOut: '2026-12-05',
          guests: 2,
          rooms: 1,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      const bookingId = res.body.data.id;
      testIdsToClean.bookings.push(bookingId);

      // 2. Poll PostgreSQL for background notification creation (up to 3 seconds)
      let customerNotif: any = null;
      for (let i = 0; i < 30; i++) {
        customerNotif = await prisma.notification.findFirst({
          where: {
            userId: customerId,
            type: 'BOOKING_CONFIRMED',
          },
          orderBy: { createdAt: 'desc' },
        });

        if (customerNotif) break;
        await new Promise((r) => setTimeout(r, 100));
      }

      expect(customerNotif).not.toBeNull();
      expect(customerNotif.userId).toBe(customerId);
      expect(customerNotif.title).toContain('Booking Confirmed');
      testIdsToClean.notifications.push(customerNotif.id);
    });
  });

  describe('Idempotent Duplicate Job Processing', () => {
    it('should process duplicate jobs without creating duplicate database notifications', async () => {
      const testEventId = `test-idemp-${Date.now()}`;
      const payload = {
        userId: customerId,
        type: 'PAYMENT_SUCCEEDED',
        title: 'Payment Succeeded',
        message: 'Your payment of INR 5000 was processed successfully.',
        idempotencyKey: testEventId,
        data: { testEventId },
      };

      // 1. Enqueue job first time
      const job1 = await queueService.enqueueNotification(
        NotificationJobName.SEND_NOTIFICATION,
        payload,
      );
      expect(job1).toBeDefined();

      // Wait for job 1 to complete in worker
      await waitForJob(job1);

      // Verify notification in PostgreSQL
      const notifsAfterFirst = await prisma.notification.findMany({
        where: {
          userId: customerId,
          type: 'PAYMENT_SUCCEEDED',
          metadata: {
            path: ['idempotencyKey'],
            equals: testEventId,
          },
        },
      });
      expect(notifsAfterFirst.length).toBe(1);
      testIdsToClean.notifications.push(notifsAfterFirst[0].id);

      // 2. Enqueue the same job a second time (simulating at-least-once redelivery)
      const job2 = await queueService.enqueueNotification(
        NotificationJobName.SEND_NOTIFICATION,
        payload,
      );
      expect(job2).toBeDefined();

      // Wait for job 2 to complete
      await waitForJob(job2);

      // Verify still exactly 1 notification exists in DB
      const notifsAfterSecond = await prisma.notification.findMany({
        where: {
          userId: customerId,
          type: 'PAYMENT_SUCCEEDED',
          metadata: {
            path: ['idempotencyKey'],
            equals: testEventId,
          },
        },
      });
      expect(notifsAfterSecond.length).toBe(1);
    });

    it('should prevent duplicate notifications across concurrent job submissions', async () => {
      const concurrentEventId = `concurrent-event-${Date.now()}`;
      const payload = {
        userId: customerId,
        type: 'CONCURRENT_TEST',
        title: 'Concurrent Idempotency',
        message: 'Testing concurrent submissions',
        idempotencyKey: concurrentEventId,
      };

      // Enqueue 5 jobs in parallel with the same idempotency key
      const jobs = await Promise.all([
        queueService.enqueueNotification(NotificationJobName.SEND_NOTIFICATION, payload),
        queueService.enqueueNotification(NotificationJobName.SEND_NOTIFICATION, payload),
        queueService.enqueueNotification(NotificationJobName.SEND_NOTIFICATION, payload),
        queueService.enqueueNotification(NotificationJobName.SEND_NOTIFICATION, payload),
        queueService.enqueueNotification(NotificationJobName.SEND_NOTIFICATION, payload),
      ]);

      await Promise.all(
        jobs.filter(Boolean).map((j) => waitForJob(j)),
      );

      // Poll to verify only 1 record created
      let matched: any[] = [];
      for (let i = 0; i < 30; i++) {
        matched = await prisma.notification.findMany({
          where: {
            userId: customerId,
            type: 'CONCURRENT_TEST',
            metadata: {
              path: ['idempotencyKey'],
              equals: concurrentEventId,
            },
          },
        });
        if (matched.length > 0) break;
        await new Promise((r) => setTimeout(r, 100));
      }

      expect(matched.length).toBe(1);
      testIdsToClean.notifications.push(matched[0].id);
    });
  });

  describe('Non-Retryable Permanent Failure', () => {
    it('should fail permanently on unrecoverable invalid payload without infinite retries', async () => {
      const invalidPayload: any = {
        userId: '', // Missing required field
        type: 'INVALID',
        title: 'No User',
        message: 'Missing user ID',
      };

      const job = await queueService.enqueueNotification(
        NotificationJobName.SEND_NOTIFICATION,
        invalidPayload,
      );

      await waitForJob(job);

      const failedJob = await queueService.getQueue(QUEUE_NAMES.NOTIFICATIONS)?.getJob(job!.id!);
      expect(await failedJob?.isFailed()).toBe(true);
      // Attempts made should be exactly 1 because it failed with UnrecoverableError
      expect(failedJob?.attemptsMade).toBe(1);
    });
  });

  describe('Scheduled Expired Bookings Cleanup Job', () => {
    it('should find expired PENDING bookings in PostgreSQL and transition them to EXPIRED', async () => {
      // 1. Manually insert an expired PENDING booking directly in DB with holdExpiresAt 10 minutes in the past
      const expiredDate = new Date(Date.now() - 10 * 60 * 1000);
      const staleBooking = await prisma.booking.create({
        data: {
          bookingReference: `STALE-${Date.now()}`,
          customerId,
          hotelId,
          status: BookingStatus.PENDING,
          checkInDate: new Date('2026-11-10'),
          checkOutDate: new Date('2026-11-12'),
          totalNights: 2,
          totalGuests: 2,
          totalAmountCents: BigInt(800000),
          holdExpiresAt: expiredDate,
          bookingRooms: {
            create: {
              roomId,
              roomTypeId,
              status: BookingRoomStatus.RESERVED,
              checkInDate: new Date('2026-11-10'),
              checkOutDate: new Date('2026-11-12'),
            },
          },
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
      testIdsToClean.bookings.push(staleBooking.id);

      // 2. Trigger Cleanup Job via Queue
      const cleanupJob = await queueService.enqueueCleanup(
        CleanupJobName.EXPIRED_BOOKINGS,
        { triggeredAt: new Date().toISOString() },
      );
      expect(cleanupJob).toBeDefined();

      await waitForJob(cleanupJob);

      // 3. Verify in PostgreSQL that booking transitioned to EXPIRED and room hold was CANCELLED
      const updatedBooking = await prisma.booking.findUnique({
        where: { id: staleBooking.id },
        include: { bookingRooms: true },
      });

      expect(updatedBooking?.status).toBe(BookingStatus.EXPIRED);
      expect(updatedBooking?.bookingRooms[0].status).toBe(BookingRoomStatus.CANCELLED);

      // 4. Repeated execution is completely idempotent and safe
      const repeatJob = await queueService.enqueueCleanup(
        CleanupJobName.EXPIRED_BOOKINGS,
        { triggeredAt: new Date().toISOString() },
      );
      await waitForJob(repeatJob);
    });
  });
});
