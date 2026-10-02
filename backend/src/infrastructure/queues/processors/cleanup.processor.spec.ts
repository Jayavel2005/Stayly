import { CleanupProcessor } from './cleanup.processor';
import { QueueService } from '../queue.service';
import { BookingLifecycleService } from '../../../modules/bookings/booking-lifecycle.service';
import { CleanupJobName } from '../queue.types';
import { Job } from 'bullmq';

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

describe('CleanupProcessor Unit Tests', () => {
  let processor: CleanupProcessor;
  let queueService: QueueService;
  let bookingLifecycleService: BookingLifecycleService;

  beforeEach(() => {
    queueService = {
      getRedisConnection: jest.fn().mockReturnValue({ host: 'localhost', port: 6379 }),
      getPrefix: jest.fn().mockReturnValue('stayora:test:bull'),
    } as unknown as QueueService;

    bookingLifecycleService = {
      expireStalePendingBookings: jest.fn().mockResolvedValue(3),
    } as unknown as BookingLifecycleService;

    processor = new CleanupProcessor(queueService, bookingLifecycleService);
    processor.onModuleInit();
  });

  afterEach(async () => {
    await processor.onApplicationShutdown();
  });

  it('should process EXPIRED_BOOKINGS job by delegating to BookingLifecycleService', async () => {
    const mockJob = {
      id: 'job-clean-1',
      name: CleanupJobName.EXPIRED_BOOKINGS,
      attemptsMade: 0,
      data: { scheduled: true },
      opts: { attempts: 3 },
    } as unknown as Job;

    const result = await processor.process(mockJob);

    expect(result).toEqual({ expiredCount: 3 });
    expect(bookingLifecycleService.expireStalePendingBookings).toHaveBeenCalledTimes(1);
  });

  it('should return 0 expiredCount and warn for unknown job name', async () => {
    const mockJob = {
      id: 'job-clean-unknown',
      name: 'unknown-job',
      attemptsMade: 0,
      data: {},
      opts: { attempts: 3 },
    } as unknown as Job;

    const result = await processor.process(mockJob);

    expect(result).toEqual({ expiredCount: 0 });
    expect(bookingLifecycleService.expireStalePendingBookings).not.toHaveBeenCalled();
  });
});
