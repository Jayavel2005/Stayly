import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as http from 'http';
import bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { RealtimeService } from '../src/infrastructure/realtime/realtime.service';
import { RealtimeEventType } from '../src/infrastructure/realtime/realtime.events';
import { PrismaService } from '../src/prisma/prisma.service';
import { GlobalExceptionFilter, TransformInterceptor } from '../src/common';

describe('Server-Sent Events (SSE) & Realtime Delivery (e2e)', () => {
  jest.setTimeout(25000);

  let app: INestApplication;
  let server: App;
  let httpServer: http.Server;
  let port: number;
  let realtimeService: RealtimeService;
  let prisma: PrismaService;

  let customerAToken: string;
  let customerAId: string;

  let customerBToken: string;
  let customerBId: string;

  let managerToken: string;
  let managerId: string;

  let adminToken: string;

  let hotelId: string;
  let roomTypeId: string;
  let roomId: string;

  const testIdsToClean: {
    bookings: string[];
    notifications: string[];
    users: string[];
  } = {
    bookings: [],
    notifications: [],
    users: [],
  };

  const activeSseConnections: Array<{ close: () => void }> = [];

  /**
   * Helper to open an SSE connection against the running HTTP server.
   */
  function openSseConnection(
    urlPath: string,
    authToken?: string,
  ): Promise<{
    req: http.ClientRequest;
    res: http.IncomingMessage;
    events: Array<{ id?: string; event?: string; data: any; raw: string }>;
    waitForEvent: (
      expectedType: string,
      timeoutMs?: number,
    ) => Promise<{ id?: string; event?: string; data: any }>;
    close: () => void;
  }> {
    return new Promise((resolve, reject) => {
      const headers: Record<string, string> = {
        Accept: 'text/event-stream',
      };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const events: Array<{ id?: string; event?: string; data: any; raw: string }> = [];
      const listeners: Array<(event: any) => void> = [];

      let buffer = '';

      const req = http.request(
        {
          host: '127.0.0.1',
          port,
          path: urlPath,
          method: 'GET',
          headers,
        },
        (res) => {
          res.on('data', (chunk: Buffer) => {
            buffer += chunk.toString('utf8');

            const blocks = buffer.split('\n\n');
            // Keep the last incomplete block in buffer
            buffer = blocks.pop() || '';

            for (const block of blocks) {
              if (!block.trim()) continue;

              const lines = block.split('\n');
              let id: string | undefined;
              let event: string | undefined;
              let dataStr = '';

              for (const line of lines) {
                if (line.startsWith('id:')) {
                  id = line.slice(3).trim();
                } else if (line.startsWith('event:')) {
                  event = line.slice(6).trim();
                } else if (line.startsWith('data:')) {
                  dataStr += line.slice(5).trim();
                }
              }

              let parsedData: any = dataStr;
              try {
                parsedData = JSON.parse(dataStr);
              } catch {
                // leave as string
              }

              const parsedEvent = { id, event, data: parsedData, raw: block };
              events.push(parsedEvent);

              for (const listener of [...listeners]) {
                listener(parsedEvent);
              }
            }
          });

          const helper = {
            req,
            res,
            events,
            waitForEvent: (expectedType: string, timeoutMs = 8000) => {
              // Check if already received
              const found = events.find(
                (e) => e.event === expectedType || e.data?.type === expectedType,
              );
              if (found) return Promise.resolve(found);

              return new Promise((resWait, rejWait) => {
                const timer = setTimeout(() => {
                  rejWait(
                    new Error(
                      `Timeout waiting for SSE event: ${expectedType}. Received: ${JSON.stringify(
                        events.map((e) => e.event || e.data?.type),
                      )}`,
                    ),
                  );
                }, timeoutMs);

                const listener = (e: any) => {
                  if (e.event === expectedType || e.data?.type === expectedType) {
                    clearTimeout(timer);
                    const idx = listeners.indexOf(listener);
                    if (idx !== -1) listeners.splice(idx, 1);
                    resWait(e);
                  }
                };

                listeners.push(listener);
              });
            },
            close: () => {
              try {
                req.destroy();
                res.destroy();
              } catch {
                // ignore
              }
              const idx = activeSseConnections.indexOf(helper);
              if (idx !== -1) {
                activeSseConnections.splice(idx, 1);
              }
            },
          };

          activeSseConnections.push(helper);
          resolve(helper);
        },
      );

      req.on('error', reject);
      req.end();
    });
  }

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
    httpServer = app.getHttpServer() as http.Server;
    server = httpServer as App;
    realtimeService = app.get<RealtimeService>(RealtimeService);
    prisma = app.get<PrismaService>(PrismaService);

    // Listen on random available port for native http streaming tests
    await new Promise<void>((resolve) => {
      httpServer.listen(0, '127.0.0.1', () => {
        const addr = httpServer.address();
        if (typeof addr === 'object' && addr) {
          port = addr.port;
        }
        resolve();
      });
    });

    // 1. Authenticate Customer A
    const custARes = await request(server)
      .post('/api/v1/auth/customer/login')
      .send({ email: 'customer@stayora.com', password: 'Password123!' });
    customerAToken = custARes.body.data.accessToken;
    customerAId = custARes.body.data.user.id;

    // 2. Ensure Customer B exists and authenticate
    const passwordHash = await bcrypt.hash('Password123!', 10);
    const customerBUserId = '00000000-0000-0000-0000-0000000000bb';
    const customerB = await prisma.user.upsert({
      where: { id: customerBUserId },
      update: { passwordHash, status: 'ACTIVE' },
      create: {
        id: customerBUserId,
        email: 'customer.realtime.b@stayora.com',
        passwordHash,
        firstName: 'Customer',
        lastName: 'Beta',
        role: 'CUSTOMER',
        status: 'ACTIVE',
      },
    });
    customerBId = customerB.id;
    testIdsToClean.users.push(customerBId);

    const custBRes = await request(server)
      .post('/api/v1/auth/customer/login')
      .send({ email: 'customer.realtime.b@stayora.com', password: 'Password123!' });
    customerBToken = custBRes.body.data.accessToken;

    // 3. Authenticate Hotel Manager & Admin
    const mgrRes = await request(server)
      .post('/api/v1/auth/manager/login')
      .send({ email: 'manager@stayora.com', password: 'Password123!' });
    managerToken = mgrRes.body.data.accessToken;
    managerId = mgrRes.body.data.user.id;

    const adminRes = await request(server)
      .post('/api/v1/auth/admin/login')
      .send({ email: 'admin@stayora.com', password: 'Password123!' });
    adminToken = adminRes.body.data.accessToken;

    // 4. Fetch seeded hotel, room type, and physical room
    const hotel = await prisma.hotel.findFirst({
      where: { slug: 'stayora-grand-palace' },
      include: {
        roomTypes: {
          include: { rooms: true },
        },
      },
    });

    if (!hotel || !hotel.roomTypes[0] || !hotel.roomTypes[0].rooms[0]) {
      throw new Error('Required seeded hotel test fixtures not found');
    }

    hotelId = hotel.id;
    roomTypeId = hotel.roomTypes[0].id;
    roomId = hotel.roomTypes[0].rooms[0].id;
  });

  afterAll(async () => {
    // Cleanup created test records
    if (testIdsToClean.notifications.length > 0) {
      await prisma.notification.deleteMany({
        where: { id: { in: testIdsToClean.notifications } },
      });
    }

    if (testIdsToClean.bookings.length > 0) {
      await prisma.bookingRoom.deleteMany({
        where: { bookingId: { in: testIdsToClean.bookings } },
      });
      await prisma.bookingPriceSnapshot.deleteMany({
        where: { bookingId: { in: testIdsToClean.bookings } },
      });
      await prisma.auditLog.deleteMany({
        where: { entityId: { in: testIdsToClean.bookings } },
      });
      await prisma.booking.deleteMany({
        where: { id: { in: testIdsToClean.bookings } },
      });
    }

    if (testIdsToClean.users.length > 0) {
      await prisma.notification.deleteMany({
        where: { userId: { in: testIdsToClean.users } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: testIdsToClean.users } },
      });
    }

    // Close any active SSE connections
    while (activeSseConnections.length > 0) {
      const conn = activeSseConnections.pop();
      conn?.close();
    }

    if (httpServer && httpServer.listening) {
      if (typeof (httpServer as any).closeAllConnections === 'function') {
        (httpServer as any).closeAllConnections();
      }
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    }

    await app.close();
  });

  afterEach(() => {
    while (activeSseConnections.length > 0) {
      const conn = activeSseConnections.pop();
      conn?.close();
    }
  });

  describe('Authentication & Connection Establishment', () => {
    it('should reject unauthenticated SSE connection with 401 Unauthorized', async () => {
      const res = await request(server).get('/api/v1/events/stream');
      expect(res.status).toBe(401);
    });

    it('should establish text/event-stream connection with Bearer JWT', async () => {
      const sse = await openSseConnection('/api/v1/events/stream', customerAToken);

      expect(sse.res.statusCode).toBe(200);
      expect(sse.res.headers['content-type']).toContain('text/event-stream');
      expect(realtimeService.getUserConnectionCount(customerAId)).toBeGreaterThanOrEqual(1);

      sse.close();
    });

    it('should establish text/event-stream connection via ?token= query parameter', async () => {
      const sse = await openSseConnection(
        `/api/v1/events/stream?token=${customerAToken}`,
      );

      expect(sse.res.statusCode).toBe(200);
      expect(sse.res.headers['content-type']).toContain('text/event-stream');

      sse.close();
    });
  });

  describe('Realtime Booking Lifecycle & Post-Commit Delivery', () => {
    it('should emit BOOKING_CREATED to connected customer after database transaction commits', async () => {
      const sse = await openSseConnection('/api/v1/events/stream', customerAToken);

      // Perform synchronous booking creation
      const res = await request(server)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          hotelId,
          roomTypeId,
          checkIn: '2027-04-10',
          checkOut: '2027-04-12',
          rooms: 1,
          guests: 1,
        });

      expect(res.status).toBe(201);
      const bookingId = res.body.data.id;
      testIdsToClean.bookings.push(bookingId);

      // Wait for SSE stream event
      const event = await sse.waitForEvent(RealtimeEventType.BOOKING_CREATED);

      expect(event).toBeDefined();
      expect(event.event).toBe(RealtimeEventType.BOOKING_CREATED);
      expect(event.data.data.bookingId).toBe(bookingId);
      expect(event.data.data.customerId).toBe(customerAId);
      expect(event.data.data.status).toBe('PENDING');

      sse.close();
    });

    it('should NOT emit a real-time event when a booking transaction fails or rolls back', async () => {
      const sse = await openSseConnection('/api/v1/events/stream', customerAToken);

      // Attempt booking with non-existent hotel (transaction will abort/fail)
      const res = await request(server)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          hotelId: '00000000-0000-4000-8000-000000000000',
          roomTypeId,
          checkIn: '2027-04-15',
          checkOut: '2027-04-17',
          rooms: 1,
          guests: 1,
        });

      expect(res.status).toBe(404);

      // Verify no BOOKING_CREATED event is emitted
      let falseEventReceived = false;
      try {
        await sse.waitForEvent(RealtimeEventType.BOOKING_CREATED, 1500);
        falseEventReceived = true;
      } catch {
        falseEventReceived = false;
      }

      expect(falseEventReceived).toBe(false);
      sse.close();
    });
  });

  describe('Security & Isolation', () => {
    it('Customer Isolation: Customer A event must NOT be delivered to Customer B', async () => {
      const sseA = await openSseConnection('/api/v1/events/stream', customerAToken);
      const sseB = await openSseConnection('/api/v1/events/stream', customerBToken);

      // Customer A creates a booking
      const res = await request(server)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          hotelId,
          roomTypeId,
          checkIn: '2027-05-10',
          checkOut: '2027-05-12',
          rooms: 1,
          guests: 1,
        });

      expect(res.status).toBe(201);
      const bookingId = res.body.data.id;
      testIdsToClean.bookings.push(bookingId);

      // Customer A receives BOOKING_CREATED
      const eventA = await sseA.waitForEvent(RealtimeEventType.BOOKING_CREATED);
      expect(eventA.data.data.bookingId).toBe(bookingId);

      // Customer B must receive NOTHING
      let bReceived = false;
      try {
        await sseB.waitForEvent(RealtimeEventType.BOOKING_CREATED, 1500);
        bReceived = true;
      } catch {
        bReceived = false;
      }

      expect(bReceived).toBe(false);

      sseA.close();
      sseB.close();
    });

    it('Manager Isolation: Assigned manager receives property event, other manager receives nothing', async () => {
      // Create a secondary hotel and assign a secondary manager to it
      const passwordHash = await bcrypt.hash('Password123!', 10);
      const managerBetaUser = await prisma.user.create({
        data: {
          email: `mgr.beta.${Date.now()}@stayora.com`,
          passwordHash,
          firstName: 'Manager',
          lastName: 'Beta',
          role: 'HOTEL_MANAGER',
          status: 'ACTIVE',
        },
      });
      testIdsToClean.users.push(managerBetaUser.id);

      const mgrBetaLogin = await request(server)
        .post('/api/v1/auth/manager/login')
        .send({ email: managerBetaUser.email, password: 'Password123!' });
      const managerBetaToken = mgrBetaLogin.body.data.accessToken;

      const sseAlpha = await openSseConnection('/api/v1/events/stream', managerToken);
      const sseBeta = await openSseConnection('/api/v1/events/stream', managerBetaToken);

      // Publish event strictly for hotelId (Grand Palace, where managerToken is assigned)
      await realtimeService.publish(
        RealtimeEventType.BOOKING_CREATED,
        { bookingId: 'bk-hotel-test', hotelId },
        { hotelId },
      );

      // Assigned manager Alpha receives event
      const eventAlpha = await sseAlpha.waitForEvent(RealtimeEventType.BOOKING_CREATED);
      expect(eventAlpha.data.data.bookingId).toBe('bk-hotel-test');

      // Unassigned manager Beta receives NOTHING
      let betaReceived = false;
      try {
        await sseBeta.waitForEvent(RealtimeEventType.BOOKING_CREATED, 1500);
        betaReceived = true;
      } catch {
        betaReceived = false;
      }

      expect(betaReceived).toBe(false);

      sseAlpha.close();
      sseBeta.close();
    });

    it('Admin Permissions: Admin receives allowed operational events', async () => {
      const sseAdmin = await openSseConnection('/api/v1/events/stream', adminToken);

      await realtimeService.publish(
        RealtimeEventType.PAYMENT_COMPLETED,
        { paymentId: 'pay-adm-1', amountCents: 15000, status: 'COMPLETED' },
        { adminOnly: true },
      );

      const event = await sseAdmin.waitForEvent(RealtimeEventType.PAYMENT_COMPLETED);
      expect(event).toBeDefined();
      expect(event.data.data.paymentId).toBe('pay-adm-1');

      sseAdmin.close();
    });
  });

  describe('Notifications Realtime Integration & REST Authority', () => {
    it('should deliver NOTIFICATION_CREATED event, and record remains authoritative in REST API', async () => {
      const sse = await openSseConnection('/api/v1/events/stream', customerAToken);

      // Trigger notification creation via NotificationsService / DB
      const notifRes = await prisma.notification.create({
        data: {
          userId: customerAId,
          type: 'SYSTEM_ALERT',
          title: 'Special Promotion',
          message: 'Get 20% off your next booking!',
          metadata: { promoCode: 'SUMMER20' },
          isRead: false,
        },
      });
      testIdsToClean.notifications.push(notifRes.id);

      // Publish realtime notification event
      await realtimeService.publish(
        RealtimeEventType.NOTIFICATION_CREATED,
        {
          notificationId: notifRes.id,
          userId: customerAId,
          type: notifRes.type,
          title: notifRes.title,
          message: notifRes.message,
          createdAt: notifRes.createdAt.toISOString(),
        },
        { userId: customerAId },
      );

      const sseEvent = await sse.waitForEvent(RealtimeEventType.NOTIFICATION_CREATED);
      expect(sseEvent.data.data.notificationId).toBe(notifRes.id);
      expect(sseEvent.data.data.title).toBe('Special Promotion');

      // Now close SSE stream (simulate disconnect)
      sse.close();

      // REST API remains authoritative: fetch notification from REST
      const restRes = await request(server)
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${customerAToken}`);

      expect(restRes.status).toBe(200);
      const items = Array.isArray(restRes.body.data)
        ? restRes.body.data
        : restRes.body.data?.items || [];
      const found = items.find((n: any) => n.id === notifRes.id);
      expect(found).toBeDefined();
      expect(found.title).toBe('Special Promotion');
    });
  });

  describe('Connection Lifecycle & Disconnection Cleanup', () => {
    it('should clean up in-memory registry when client connection drops', async () => {
      const initialCount = realtimeService.getUserConnectionCount(customerAId);

      const sse = await openSseConnection('/api/v1/events/stream', customerAToken);
      expect(realtimeService.getUserConnectionCount(customerAId)).toBe(initialCount + 1);

      sse.close();

      // Give Node an event loop tick to execute the finalize hook
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(realtimeService.getUserConnectionCount(customerAId)).toBe(initialCount);
    });
  });
});
