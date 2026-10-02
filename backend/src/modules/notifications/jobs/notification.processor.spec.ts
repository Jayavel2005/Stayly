import { NotificationProcessor } from './notification.processor';
import { QueueService } from '../../../infrastructure/queues/queue.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationJobName } from '../../../infrastructure/queues/queue.types';
import { Job, UnrecoverableError } from 'bullmq';

jest.mock('bullmq', () => {
  const actual = jest.requireActual('bullmq');
  return {
    ...actual,
    Worker: jest.fn().mockImplementation((name: string, handler: any, opts: any) => {
      return {
        name,
        opts,
        on: jest.fn(),
        close: jest.fn().mockResolvedValue(undefined),
      };
    }),
  };
});

describe('NotificationProcessor Unit Tests', () => {
  let processor: NotificationProcessor;
  let queueService: QueueService;
  let prisma: any;

  beforeEach(() => {
    queueService = {
      getRedisConnection: jest.fn().mockReturnValue({ host: 'localhost', port: 6379 }),
      getPrefix: jest.fn().mockReturnValue('stayora:test:bull'),
    } as unknown as QueueService;

    prisma = {
      notification: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      hotelManager: {
        findMany: jest.fn(),
      },
    };

    processor = new NotificationProcessor(queueService, prisma as PrismaService);
    processor.onModuleInit();
  });

  afterEach(async () => {
    await processor.onApplicationShutdown();
  });

  describe('SEND_NOTIFICATION', () => {
    it('should create notification in database for valid payload', async () => {
      prisma.notification.findFirst.mockResolvedValue(null);
      prisma.notification.create.mockResolvedValue({ id: 'notif-101' });

      const mockJob = {
        id: 'job-send-1',
        name: NotificationJobName.SEND_NOTIFICATION,
        attemptsMade: 0,
        data: {
          userId: 'user-abc',
          type: 'BOOKING_CONFIRMED',
          title: 'Booking Confirmed',
          message: 'Your room is confirmed.',
          data: { bookingId: 'b-1' },
          idempotencyKey: 'idemp-1',
        },
        opts: { attempts: 3 },
      } as unknown as Job;

      const result = await processor.process(mockJob);

      expect(result).toEqual({ notificationId: 'notif-101', status: 'created' });
      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-abc',
          type: 'BOOKING_CONFIRMED',
          title: 'Booking Confirmed',
          message: 'Your room is confirmed.',
          metadata: expect.objectContaining({
            bookingId: 'b-1',
            idempotencyKey: 'idemp-1',
          }),
        }),
      });
    });

    it('should throw UnrecoverableError for invalid payload (missing required field)', async () => {
      const mockJob = {
        id: 'job-invalid-1',
        name: NotificationJobName.SEND_NOTIFICATION,
        attemptsMade: 0,
        data: {
          userId: '',
          type: 'TEST',
          title: 'T',
          message: '',
        },
        opts: { attempts: 3 },
      } as unknown as Job;

      await expect(processor.process(mockJob)).rejects.toThrow(UnrecoverableError);
      expect(prisma.notification.create).not.toHaveBeenCalled();
    });

    it('should detect duplicate notification and skip creation (idempotency)', async () => {
      prisma.notification.findFirst.mockResolvedValue({ id: 'existing-notif-999' });

      const mockJob = {
        id: 'job-duplicate',
        name: NotificationJobName.SEND_NOTIFICATION,
        attemptsMade: 1,
        data: {
          userId: 'user-xyz',
          type: 'PAYMENT_SUCCEEDED',
          title: 'Payment Received',
          message: 'Paid',
          idempotencyKey: 'pay-event-777',
        },
        opts: { attempts: 3 },
      } as unknown as Job;

      const result = await processor.process(mockJob);

      expect(result).toEqual({
        notificationId: 'existing-notif-999',
        status: 'already_processed',
      });
      expect(prisma.notification.findFirst).toHaveBeenCalledWith({
        where: {
          userId: 'user-xyz',
          type: 'PAYMENT_SUCCEEDED',
          metadata: {
            path: ['idempotencyKey'],
            equals: 'pay-event-777',
          },
        },
      });
      expect(prisma.notification.create).not.toHaveBeenCalled();
    });
  });

  describe('FANOUT_HOTEL_MANAGERS', () => {
    it('should fan out notifications to all assigned hotel managers', async () => {
      prisma.hotelManager.findMany.mockResolvedValue([
        { userId: 'mgr-1' },
        { userId: 'mgr-2' },
      ]);
      prisma.notification.findFirst.mockResolvedValue(null);
      prisma.notification.create.mockResolvedValue({ id: 'notif-mgr' });

      const mockJob = {
        id: 'job-fanout-1',
        name: NotificationJobName.FANOUT_HOTEL_MANAGERS,
        attemptsMade: 0,
        data: {
          hotelId: 'hotel-grand',
          type: 'NEW_BOOKING_RECEIVED',
          title: 'New Booking',
          message: 'Room booked',
          idempotencyKey: 'event-booking-1',
        },
        opts: { attempts: 3 },
      } as unknown as Job;

      const result = await processor.process(mockJob);

      expect(result).toEqual({ dispatchedCount: 2, status: 'dispatched' });
      expect(prisma.hotelManager.findMany).toHaveBeenCalledWith({
        where: { hotelId: 'hotel-grand' },
        select: { userId: true },
      });
      expect(prisma.notification.create).toHaveBeenCalledTimes(2);
    });

    it('should handle hotel with no assigned managers gracefully', async () => {
      prisma.hotelManager.findMany.mockResolvedValue([]);

      const mockJob = {
        id: 'job-fanout-empty',
        name: NotificationJobName.FANOUT_HOTEL_MANAGERS,
        attemptsMade: 0,
        data: {
          hotelId: 'hotel-empty',
          type: 'NEW_BOOKING_RECEIVED',
          title: 'New Booking',
          message: 'Room booked',
        },
        opts: { attempts: 3 },
      } as unknown as Job;

      const result = await processor.process(mockJob);

      expect(result).toEqual({ dispatchedCount: 0, status: 'dispatched' });
      expect(prisma.notification.create).not.toHaveBeenCalled();
    });

    it('should throw UnrecoverableError if fanout payload is missing required hotelId', async () => {
      const mockJob = {
        id: 'job-fanout-invalid',
        name: NotificationJobName.FANOUT_HOTEL_MANAGERS,
        attemptsMade: 0,
        data: {
          hotelId: '',
          type: 'TEST',
          title: 'T',
          message: 'M',
        },
        opts: { attempts: 3 },
      } as unknown as Job;

      await expect(processor.process(mockJob)).rejects.toThrow(UnrecoverableError);
    });
  });

  describe('Unknown job name', () => {
    it('should throw UnrecoverableError for unrecognized job names', async () => {
      const mockJob = {
        id: 'unknown-job-id',
        name: 'unexpected-name',
        attemptsMade: 0,
        data: {},
        opts: { attempts: 3 },
      } as unknown as Job;

      await expect(processor.process(mockJob)).rejects.toThrow(UnrecoverableError);
    });
  });
});
