import { ConfigService } from '@nestjs/config';
import { QueueService } from './queue.service';
import { QUEUE_NAMES, QUEUE_OPTIONS } from './queue.constants';
import { NotificationJobName, CleanupJobName } from './queue.types';
import { Queue } from 'bullmq';

jest.mock('bullmq', () => {
  const actual = jest.requireActual('bullmq');
  return {
    ...actual,
    Queue: jest.fn().mockImplementation((name: string, opts: any) => {
      return {
        name,
        opts,
        add: jest.fn().mockResolvedValue({ id: 'job-123', name }),
        upsertJobScheduler: jest.fn().mockResolvedValue({ id: 'job-123', name }),
        getJobCounts: jest.fn().mockResolvedValue({
          waiting: 0,
          active: 1,
          completed: 5,
          failed: 0,
          delayed: 0,
        }),
        client: Promise.resolve({
          ping: jest.fn().mockResolvedValue('PONG'),
        }),
        close: jest.fn().mockResolvedValue(undefined),
      };
    }),
  };
});

describe('QueueService Unit Tests', () => {
  let service: QueueService;
  let configService: ConfigService;

  beforeEach(async () => {
    configService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        if (key === 'redis.host') return 'localhost';
        if (key === 'redis.port') return 6379;
        if (key === 'redis.password') return undefined;
        if (key === 'redis.db') return 0;
        return defaultValue;
      }),
    } as unknown as ConfigService;

    service = new QueueService(configService);
    await service.onModuleInit();
  });

  afterEach(async () => {
    await service.onApplicationShutdown();
  });

  describe('initialization', () => {
    it('should initialize queues with default options and prefix', () => {
      expect(Queue).toHaveBeenCalledWith(
        QUEUE_NAMES.NOTIFICATIONS,
        expect.objectContaining({
          prefix: expect.stringContaining('bull'),
          defaultJobOptions: expect.objectContaining({
            attempts: QUEUE_OPTIONS.DEFAULT_ATTEMPTS,
            backoff: expect.objectContaining({ type: 'exponential' }),
          }),
        }),
      );

      expect(Queue).toHaveBeenCalledWith(
        QUEUE_NAMES.CLEANUP,
        expect.objectContaining({
          prefix: expect.stringContaining('bull'),
        }),
      );
    });

    it('should register repeatable cleanup job on initialization', async () => {
      const cleanupQueue = service.getQueue(QUEUE_NAMES.CLEANUP);
      expect(cleanupQueue?.upsertJobScheduler).toHaveBeenCalledWith(
        'repeatable-cleanup-expired-bookings',
        { every: QUEUE_OPTIONS.CLEANUP_INTERVAL_MS },
        {
          name: CleanupJobName.EXPIRED_BOOKINGS,
          data: { scheduled: true },
        },
      );
    });
  });

  describe('enqueueNotification', () => {
    it('should enqueue a notification job to NOTIFICATIONS queue', async () => {
      const payload = {
        userId: 'user-1',
        type: 'BOOKING_CONFIRMED',
        title: 'Booking Confirmed',
        message: 'Your stay is booked!',
      };

      const job = await service.enqueueNotification(
        NotificationJobName.SEND_NOTIFICATION,
        payload,
        { jobId: 'custom-job-id' },
      );

      expect(job).toBeDefined();
      expect(job?.id).toBe('job-123');

      const notifQueue = service.getQueue(QUEUE_NAMES.NOTIFICATIONS);
      expect(notifQueue?.add).toHaveBeenCalledWith(
        NotificationJobName.SEND_NOTIFICATION,
        payload,
        { jobId: 'custom-job-id' },
      );
    });
  });

  describe('enqueueCleanup', () => {
    it('should enqueue a cleanup job to CLEANUP queue', async () => {
      const payload = { triggeredAt: new Date().toISOString() };

      const job = await service.enqueueCleanup(
        CleanupJobName.EXPIRED_BOOKINGS,
        payload,
      );

      expect(job).toBeDefined();
      const cleanupQueue = service.getQueue(QUEUE_NAMES.CLEANUP);
      expect(cleanupQueue?.add).toHaveBeenCalledWith(
        CleanupJobName.EXPIRED_BOOKINGS,
        payload,
        undefined,
      );
    });
  });

  describe('isHealthy & getJobCounts', () => {
    it('should report healthy when all queues respond with PONG', async () => {
      const healthy = await service.isHealthy();
      expect(healthy).toBe(true);
    });

    it('should retrieve job counts for initialized queue', async () => {
      const counts = await service.getJobCounts(QUEUE_NAMES.NOTIFICATIONS);
      expect(counts).toEqual({
        waiting: 0,
        active: 1,
        completed: 5,
        failed: 0,
        delayed: 0,
      });
    });
  });

  describe('graceful error handling', () => {
    it('should return null without throwing when queue.add fails', async () => {
      const notifQueue = service.getQueue(QUEUE_NAMES.NOTIFICATIONS);
      (notifQueue?.add as jest.Mock).mockRejectedValueOnce(new Error('Redis connection down'));

      const result = await service.enqueueNotification(
        NotificationJobName.SEND_NOTIFICATION,
        {
          userId: 'u1',
          type: 'TEST',
          title: 'T',
          message: 'M',
        },
      );

      expect(result).toBeNull();
    });
  });
});
