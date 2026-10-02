import {
  Injectable,
  Logger,
  OnModuleInit,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, JobsOptions, Job } from 'bullmq';
import {
  QUEUE_NAMES,
  QueueName,
  QUEUE_OPTIONS,
} from './queue.constants';
import {
  NotificationJobName,
  CleanupJobName,
  SendNotificationJobPayload,
  FanoutHotelManagersJobPayload,
  CleanupExpiredBookingsJobPayload,
  QueueJobCounts,
} from './queue.types';

@Injectable()
export class QueueService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(QueueService.name);
  private readonly queues = new Map<QueueName, Queue>();
  private readonly redisConnection: Record<string, any>;
  private readonly prefix: string;

  constructor(private readonly configService: ConfigService) {
    const env = process.env.NODE_ENV || 'development';
    this.prefix = `stayora:${env}:bull`;

    const redisUrl = this.configService.get<string>('redis.url');
    const host = this.configService.get<string>('redis.host', 'localhost');
    const port = this.configService.get<number>('redis.port', 6379);
    const password = this.configService.get<string>('redis.password');
    const db = this.configService.get<number>('redis.db', 0);

    if (redisUrl) {
      this.redisConnection = {
        url: redisUrl,
        maxRetriesPerRequest: null,
      };
    } else {
      this.redisConnection = {
        host,
        port,
        password: password || undefined,
        db,
        maxRetriesPerRequest: null,
      };
    }
  }

  async onModuleInit(): Promise<void> {
    this.logger.log('Initializing BullMQ Queues...');
    try {
      this.initQueue(QUEUE_NAMES.NOTIFICATIONS);
      this.initQueue(QUEUE_NAMES.CLEANUP);

      // Register scheduled repeatable job for expired bookings cleanup
      await this.scheduleRepeatableCleanup();
      this.logger.log('BullMQ Queues initialized successfully.');
    } catch (err: any) {
      this.logger.warn(
        `[QueueService] Notice during queue initialization: ${err.message}. Application will continue bootstrap.`,
      );
    }
  }

  /**
   * Initializes a BullMQ queue with production default options.
   */
  private initQueue(name: QueueName): Queue {
    const defaultJobOptions: JobsOptions = {
      attempts: QUEUE_OPTIONS.DEFAULT_ATTEMPTS,
      backoff: {
        type: 'exponential',
        delay: QUEUE_OPTIONS.BACKOFF_DELAY,
      },
      removeOnComplete: {
        age: QUEUE_OPTIONS.COMPLETED_JOB_RETENTION.age,
        count: QUEUE_OPTIONS.COMPLETED_JOB_RETENTION.count,
      },
      removeOnFail: {
        age: QUEUE_OPTIONS.FAILED_JOB_RETENTION.age,
        count: QUEUE_OPTIONS.FAILED_JOB_RETENTION.count,
      },
    };

    const queue = new Queue(name, {
      connection: this.redisConnection,
      prefix: this.prefix,
      defaultJobOptions,
    });

    this.queues.set(name, queue);
    return queue;
  }

  /**
   * Schedules a repeatable background job for stale booking expiration (every 1 minute).
   * BullMQ handles distributed deduplication across multiple backend instances automatically.
   */
  async scheduleRepeatableCleanup(): Promise<void> {
    const cleanupQueue = this.getQueue(QUEUE_NAMES.CLEANUP);
    if (!cleanupQueue) return;

    try {
      await cleanupQueue.upsertJobScheduler(
        'repeatable-cleanup-expired-bookings',
        { every: QUEUE_OPTIONS.CLEANUP_INTERVAL_MS },
        {
          name: CleanupJobName.EXPIRED_BOOKINGS,
          data: { scheduled: true },
        },
      );
      this.logger.log(
        `Scheduled repeatable cleanup job [${CleanupJobName.EXPIRED_BOOKINGS}] every ${QUEUE_OPTIONS.CLEANUP_INTERVAL_MS / 1000}s.`,
      );
    } catch (err: any) {
      this.logger.warn(
        `[QueueService] Could not register repeatable cleanup job: ${err.message}`,
      );
    }
  }

  /**
   * Enqueues a notification job with strongly typed payload and options.
   * Automatically uses idempotencyKey as BullMQ jobId for queue-level deduplication.
   */
  async enqueueNotification(
    jobName: NotificationJobName,
    payload: SendNotificationJobPayload | FanoutHotelManagersJobPayload,
    opts?: JobsOptions,
  ): Promise<Job | null> {
    const effectiveJobId =
      opts?.jobId
        ? opts.jobId.replace(/[:]/g, '-')
        : payload.idempotencyKey
          ? `notif-${(payload as any).userId || (payload as any).hotelId}-${payload.type}-${payload.idempotencyKey}`.replace(/[:]/g, '-')
          : undefined;

    const mergedOpts = effectiveJobId ? { ...opts, jobId: effectiveJobId } : opts;
    return this.enqueue(QUEUE_NAMES.NOTIFICATIONS, jobName, payload, mergedOpts);
  }

  /**
   * Enqueues a cleanup job.
   */
  async enqueueCleanup(
    jobName: CleanupJobName,
    payload: CleanupExpiredBookingsJobPayload = {},
    opts?: JobsOptions,
  ): Promise<Job | null> {
    return this.enqueue(QUEUE_NAMES.CLEANUP, jobName, payload, opts);
  }

  /**
   * Generic enqueue method.
   * Catches errors gracefully and returns null on queue failure to prevent secondary work from crashing the caller.
   */
  async enqueue<T>(
    queueName: QueueName,
    jobName: string,
    payload: T,
    opts?: JobsOptions,
  ): Promise<Job<T> | null> {
    const queue = this.getQueue(queueName);
    if (!queue) {
      this.logger.warn(`Queue ${queueName} not found when attempting to enqueue ${jobName}.`);
      return null;
    }

    try {
      const job = await queue.add(jobName, payload, opts);
      this.logger.log(
        `[QueueService] Job queued: ${queueName} -> ${jobName} [ID: ${job.id}]`,
      );
      return job;
    } catch (err: any) {
      this.logger.error(
        `[QueueService] Failed to enqueue job ${jobName} on queue ${queueName}: ${err.message}`,
        err.stack,
      );
      return null;
    }
  }

  /**
   * Retrieves an initialized BullMQ queue instance.
   */
  getQueue(name: QueueName): Queue | undefined {
    return this.queues.get(name);
  }

  /**
   * Returns current job counts for a queue.
   */
  async getJobCounts(name: QueueName): Promise<QueueJobCounts | null> {
    const queue = this.getQueue(name);
    if (!queue) return null;

    try {
      const counts = await queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');
      return {
        waiting: counts.waiting ?? 0,
        active: counts.active ?? 0,
        completed: counts.completed ?? 0,
        failed: counts.failed ?? 0,
        delayed: counts.delayed ?? 0,
      };
    } catch (err: any) {
      this.logger.warn(`Failed to get job counts for queue ${name}: ${err.message}`);
      return null;
    }
  }

  /**
   * Health verification check for BullMQ queues.
   */
  async isHealthy(): Promise<boolean> {
    try {
      if (this.queues.size === 0) return true;
      for (const queue of this.queues.values()) {
        await queue.getJobCounts('waiting');
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Connection options used by workers to connect to Redis.
   */
  getRedisConnection(): Record<string, any> {
    return { ...this.redisConnection };
  }

  /**
   * Prefix used for Redis keys by BullMQ.
   */
  getPrefix(): string {
    return this.prefix;
  }

  /**
   * Graceful shutdown of all queue connections.
   */
  async onApplicationShutdown(signal?: string): Promise<void> {
    this.logger.log(`Closing BullMQ queue connections on application shutdown (signal: ${signal})...`);
    for (const [name, queue] of this.queues.entries()) {
      try {
        await queue.close();
        this.logger.log(`Closed queue ${name}.`);
      } catch (err: any) {
        this.logger.warn(`Error closing queue ${name}: ${err.message}`);
      }
    }
  }
}
