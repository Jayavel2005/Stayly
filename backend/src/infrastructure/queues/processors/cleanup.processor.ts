import {
  Injectable,
  Logger,
  OnModuleInit,
  OnApplicationShutdown,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { QueueService } from '../queue.service';
import { QUEUE_NAMES, QUEUE_OPTIONS } from '../queue.constants';
import { CleanupJobName, CleanupExpiredBookingsJobPayload } from '../queue.types';
import { BookingLifecycleService } from '../../../modules/bookings/booking-lifecycle.service';

@Injectable()
export class CleanupProcessor implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(CleanupProcessor.name);
  private worker!: Worker;

  constructor(
    private readonly queueService: QueueService,
    @Inject(forwardRef(() => BookingLifecycleService))
    private readonly bookingLifecycleService: BookingLifecycleService,
  ) {}

  onModuleInit(): void {
    this.logger.log('Starting CleanupProcessor BullMQ Worker...');
    const connection = this.queueService.getRedisConnection();
    const prefix = this.queueService.getPrefix();

    this.worker = new Worker(
      QUEUE_NAMES.CLEANUP,
      async (job: Job<CleanupExpiredBookingsJobPayload>) => {
        return this.process(job);
      },
      {
        connection,
        prefix,
        concurrency: QUEUE_OPTIONS.WORKER_CONCURRENCY.CLEANUP,
      },
    );

    this.worker.on('completed', (job: Job, result: any) => {
      this.logger.log(
        `[CleanupWorker] Job completed: ${job.name} [ID: ${job.id}] -> Result: ${JSON.stringify(result)}`,
      );
    });

    this.worker.on('failed', (job: Job | undefined, err: Error) => {
      this.logger.error(
        `[CleanupWorker] Job failed: ${job?.name} [ID: ${job?.id}] Attempt ${job?.attemptsMade}/${job?.opts.attempts}: ${err.message}`,
        err.stack,
      );
    });

    this.worker.on('error', (err: Error) => {
      this.logger.warn(`[CleanupWorker] Worker error: ${err.message}`);
    });

    this.logger.log('CleanupProcessor BullMQ Worker running.');
  }

  /**
   * Main job processing logic.
   * PostgreSQL is the absolute authority for determining expired bookings.
   */
  async process(job: Job<CleanupExpiredBookingsJobPayload>): Promise<{ expiredCount: number }> {
    const startTime = Date.now();
    this.logger.log(
      `[CleanupWorker] Job started: ${job.name} [ID: ${job.id}] (Attempt: ${job.attemptsMade + 1})`,
    );

    if (job.name === CleanupJobName.EXPIRED_BOOKINGS) {
      const expiredCount = await this.bookingLifecycleService.expireStalePendingBookings();
      const durationMs = Date.now() - startTime;
      this.logger.log(
        `[CleanupWorker] Successfully scanned and expired ${expiredCount} stale bookings in ${durationMs}ms.`,
      );
      return { expiredCount };
    }

    this.logger.warn(`[CleanupWorker] Unknown job name received: ${job.name}`);
    return { expiredCount: 0 };
  }

  /**
   * Returns worker instance for testing or observability.
   */
  getWorker(): Worker {
    return this.worker;
  }

  async onApplicationShutdown(signal?: string): Promise<void> {
    this.logger.log(`Closing CleanupProcessor worker (signal: ${signal})...`);
    if (this.worker) {
      try {
        await this.worker.close();
        this.logger.log('CleanupProcessor worker closed.');
      } catch (err: any) {
        this.logger.warn(`Error closing CleanupProcessor worker: ${err.message}`);
      }
    }
  }
}
