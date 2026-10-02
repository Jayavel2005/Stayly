import { ConfigService } from '@nestjs/config';
import { RealtimeService } from './realtime.service';
import { RealtimeEventType } from './realtime.events';
import { REALTIME_CONFIG } from './realtime.constants';
import { AuthenticatedUser } from '../../modules/auth/types/authenticated-user.type';
import { UserRole } from '../../modules/auth/types/user-role.enum';
import { PrismaService } from '../../prisma/prisma.service';
import { MessageEvent } from '@nestjs/common';

describe('RealtimeService Unit Tests', () => {
  let service: RealtimeService;
  let configService: ConfigService;
  let prisma: PrismaService;

  const mockCustomerUser: AuthenticatedUser = {
    id: 'user-customer-1',
    email: 'guest@stayora.com',
    role: UserRole.CUSTOMER,
    status: 'ACTIVE',
  };

  const mockCustomerUser2: AuthenticatedUser = {
    id: 'user-customer-2',
    email: 'guest2@stayora.com',
    role: UserRole.CUSTOMER,
    status: 'ACTIVE',
  };

  const mockManagerUser: AuthenticatedUser = {
    id: 'user-manager-1',
    email: 'manager@stayora.com',
    role: UserRole.HOTEL_MANAGER,
    status: 'ACTIVE',
  };

  const mockAdminUser: AuthenticatedUser = {
    id: 'user-admin-1',
    email: 'admin@stayora.com',
    role: UserRole.ADMIN,
    status: 'ACTIVE',
  };

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'realtime.heartbeatIntervalMs') return 60000;
        if (key === 'realtime.maxConnectionsPerUser') return 3;
        return undefined;
      }),
    } as unknown as ConfigService;

    prisma = {
      hotelManager: {
        findMany: jest.fn().mockImplementation(({ where }) => {
          if (where.hotelId === 'hotel-alpha') {
            return Promise.resolve([{ userId: 'user-manager-1' }]);
          }
          if (where.hotelId === 'hotel-beta') {
            return Promise.resolve([{ userId: 'user-manager-other' }]);
          }
          return Promise.resolve([]);
        }),
      },
    } as unknown as PrismaService;

    service = new RealtimeService(configService, prisma);
    service.onModuleInit();
  });

  afterEach(() => {
    service.onApplicationShutdown();
  });

  describe('Connection Registry & Limits', () => {
    it('should register an authenticated client connection', () => {
      const { connectionId, stream } = service.registerConnection(mockCustomerUser);

      expect(connectionId).toBeDefined();
      expect(stream).toBeDefined();
      expect(service.getConnectionCount()).toBe(1);
      expect(service.getUserConnectionCount(mockCustomerUser.id)).toBe(1);
      expect(service.getActiveUserCount()).toBe(1);
    });

    it('should support multiple concurrent connections for the same user', () => {
      const conn1 = service.registerConnection(mockCustomerUser);
      const conn2 = service.registerConnection(mockCustomerUser);

      expect(conn1.connectionId).not.toBe(conn2.connectionId);
      expect(service.getConnectionCount()).toBe(2);
      expect(service.getUserConnectionCount(mockCustomerUser.id)).toBe(2);
      expect(service.getActiveUserCount()).toBe(1);
    });

    it('should evict the oldest connection when maxConnectionsPerUser is exceeded', () => {
      // Configured max is 3
      const conn1 = service.registerConnection(mockCustomerUser);
      const conn2 = service.registerConnection(mockCustomerUser);
      const conn3 = service.registerConnection(mockCustomerUser);

      expect(service.getUserConnectionCount(mockCustomerUser.id)).toBe(3);

      let conn1Closed = false;
      conn1.stream.subscribe({
        complete: () => {
          conn1Closed = true;
        },
      });

      // 4th connection should evict conn1
      const conn4 = service.registerConnection(mockCustomerUser);

      expect(conn1Closed).toBe(true);
      expect(service.getUserConnectionCount(mockCustomerUser.id)).toBe(3);
      expect(conn4.connectionId).toBeDefined();
    });

    it('should cleanly remove connection and user key on disconnect', (done) => {
      const { connectionId, stream } = service.registerConnection(mockCustomerUser);

      expect(service.getUserConnectionCount(mockCustomerUser.id)).toBe(1);

      const subscription = stream.subscribe();

      // Unsubscribe simulates browser disconnect triggering finalize()
      subscription.unsubscribe();

      // Check asynchronously to allow finalize hook to execute
      setTimeout(() => {
        expect(service.getUserConnectionCount(mockCustomerUser.id)).toBe(0);
        expect(service.getActiveUserCount()).toBe(0);
        expect(service.getConnectionCount()).toBe(0);
        done();
      }, 10);
    });
  });

  describe('Event Routing & Isolation', () => {
    it('should deliver event only to the targeted customer and not to other customers', async () => {
      const customer1 = service.registerConnection(mockCustomerUser);
      const customer2 = service.registerConnection(mockCustomerUser2);

      const receivedByCustomer1: MessageEvent[] = [];
      const receivedByCustomer2: MessageEvent[] = [];

      customer1.stream.subscribe((e) => receivedByCustomer1.push(e));
      customer2.stream.subscribe((e) => receivedByCustomer2.push(e));

      // Publish event addressed strictly to customer 1
      await service.publish(
        RealtimeEventType.BOOKING_CONFIRMED,
        { bookingId: 'bk-123', status: 'CONFIRMED' },
        { userId: mockCustomerUser.id },
      );

      expect(receivedByCustomer1.length).toBe(1);
      expect(receivedByCustomer1[0].type).toBe(RealtimeEventType.BOOKING_CONFIRMED);
      expect((receivedByCustomer1[0].data as any).data.bookingId).toBe('bk-123');

      // Customer 2 MUST receive 0 events (strict tenant isolation)
      expect(receivedByCustomer2.length).toBe(0);
    });

    it('should route property events to assigned hotel managers and ignore unassigned managers', async () => {
      const managerAlpha = service.registerConnection(mockManagerUser); // assigned to hotel-alpha
      const managerBetaUser: AuthenticatedUser = {
        id: 'user-manager-other',
        email: 'other@stayora.com',
        role: UserRole.HOTEL_MANAGER,
        status: 'ACTIVE',
      };
      const managerBeta = service.registerConnection(managerBetaUser); // assigned to hotel-beta

      const alphaEvents: MessageEvent[] = [];
      const betaEvents: MessageEvent[] = [];

      managerAlpha.stream.subscribe((e) => alphaEvents.push(e));
      managerBeta.stream.subscribe((e) => betaEvents.push(e));

      // Publish event for hotel-alpha
      await service.publish(
        RealtimeEventType.BOOKING_CREATED,
        { bookingId: 'bk-hotel-alpha', hotelId: 'hotel-alpha' },
        { hotelId: 'hotel-alpha' },
      );

      // Manager Alpha receives event
      expect(alphaEvents.length).toBe(1);
      expect((alphaEvents[0].data as any).data.bookingId).toBe('bk-hotel-alpha');

      // Manager Beta receives NOTHING for hotel-alpha
      expect(betaEvents.length).toBe(0);
    });

    it('should deliver allowed operational events to active admins when includeAdmins is true', async () => {
      const admin = service.registerConnection(mockAdminUser);
      const customer = service.registerConnection(mockCustomerUser);

      const adminEvents: MessageEvent[] = [];
      const customerEvents: MessageEvent[] = [];

      admin.stream.subscribe((e) => adminEvents.push(e));
      customer.stream.subscribe((e) => customerEvents.push(e));

      await service.publish(
        RealtimeEventType.PAYMENT_COMPLETED,
        { paymentId: 'pay-999', status: 'COMPLETED' },
        { userId: mockCustomerUser.id, includeAdmins: true },
      );

      expect(customerEvents.length).toBe(1);
      expect(adminEvents.length).toBe(1);
      expect(adminEvents[0].type).toBe(RealtimeEventType.PAYMENT_COMPLETED);
    });

    it('should format message events with unique event ID, timestamp, and retry interval', async () => {
      const customer = service.registerConnection(mockCustomerUser);
      const events: MessageEvent[] = [];
      customer.stream.subscribe((e) => events.push(e));

      await service.publish(
        RealtimeEventType.BOOKING_CANCELLED,
        { bookingId: 'bk-cancel-1' },
        { userId: mockCustomerUser.id },
      );

      expect(events.length).toBe(1);
      const msg = events[0];
      expect(msg.id).toMatch(/^evt_/);
      expect(msg.type).toBe(RealtimeEventType.BOOKING_CANCELLED);
      expect(msg.retry).toBe(REALTIME_CONFIG.DEFAULT_RETRY_MS);

      const envelope = msg.data as any;
      expect(envelope.id).toBe(msg.id);
      expect(envelope.type).toBe(RealtimeEventType.BOOKING_CANCELLED);
      expect(new Date(envelope.timestamp).getTime()).not.toBeNaN();
      expect(envelope.data.bookingId).toBe('bk-cancel-1');
    });
  });

  describe('Graceful Shutdown', () => {
    it('should complete all open connections and clear registry on shutdown', () => {
      const conn1 = service.registerConnection(mockCustomerUser);
      const conn2 = service.registerConnection(mockAdminUser);

      let conn1Done = false;
      let conn2Done = false;

      conn1.stream.subscribe({ complete: () => (conn1Done = true) });
      conn2.stream.subscribe({ complete: () => (conn2Done = true) });

      service.onApplicationShutdown('SIGTERM');

      expect(conn1Done).toBe(true);
      expect(conn2Done).toBe(true);
      expect(service.getConnectionCount()).toBe(0);
      expect(service.getActiveUserCount()).toBe(0);
    });
  });
});
