import {
  Injectable,
  Logger,
  OnModuleInit,
  OnApplicationShutdown,
} from '@nestjs/common';
import { Worker, Job, UnrecoverableError } from 'bullmq';
import { Prisma } from '@prisma/client';
import { QueueService } from '../../../infrastructure/queues/queue.service';
import { QUEUE_NAMES, QUEUE_OPTIONS } from '../../../infrastructure/queues/queue.constants';
import {
  NotificationJobName,
  SendNotificationJobPayload,
  FanoutHotelManagersJobPayload,
} from '../../../infrastructure/queues/queue.types';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class NotificationProcessor implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(NotificationProcessor.name);
  private worker!: Worker;

  constructor(
    private readonly queueService: QueueService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit(): void {
    this.logger.log('Starting NotificationProcessor BullMQ Worker...');
    const connection = this.queueService.getRedisConnection();
    const prefix = this.queueService.getPrefix();

    this.worker = new Worker(
      QUEUE_NAMES.NOTIFICATIONS,
      async (job: Job) => {
        return this.process(job);
      },
      {
        connection,
        prefix,
        concurrency: QUEUE_OPTIONS.WORKER_CONCURRENCY.NOTIFICATIONS,
      },
    );

    this.worker.on('completed', (job: Job, result: any) => {
      this.logger.log(
        `[NotificationWorker] Job completed: ${job.name} [ID: ${job.id}] -> ${JSON.stringify(result)}`,
      );
    });

    this.worker.on('failed', (job: Job | undefined, err: Error) => {
      this.logger.error(
        `[NotificationWorker] Job failed: ${job?.name} [ID: ${job?.id}] Attempt ${job?.attemptsMade}/${job?.opts.attempts}: ${err.message}`,
        err.stack,
      );
    });

    this.worker.on('error', (err: Error) => {
      this.logger.warn(`[NotificationWorker] Worker error: ${err.message}`);
    });

    this.logger.log('NotificationProcessor BullMQ Worker running.');
  }

  /**
   * Main job processing dispatcher.
   */
  async process(job: Job): Promise<any> {
    const startTime = Date.now();
    this.logger.log(
      `[NotificationWorker] Processing job ${job.name} [ID: ${job.id}] (Attempt: ${job.attemptsMade + 1})`,
    );

    switch (job.name) {
      case NotificationJobName.SEND_NOTIFICATION:
        return this.processSendNotification(job as Job<SendNotificationJobPayload>, startTime);

      case NotificationJobName.FANOUT_HOTEL_MANAGERS:
        return this.processFanoutHotelManagers(job as Job<FanoutHotelManagersJobPayload>, startTime);

      default:
        this.logger.warn(`[NotificationWorker] Unknown job name: ${job.name}`);
        throw new UnrecoverableError(`Unknown job name: ${job.name}`);
    }
  }

  /**
   * Processes a single direct user notification job.
   * Enforces business-level idempotency to prevent duplicate notifications on at-least-once delivery.
   */
  private async processSendNotification(
    job: Job<SendNotificationJobPayload>,
    startTime: number,
  ): Promise<{ notificationId: string; status: 'created' | 'already_processed' }> {
    const { userId, type, title, message, data, idempotencyKey, eventId } = job.data;

    // 1. Validation (permanent failure if missing required fields)
    if (!userId || !type || !title || !message) {
      const errMessage = `Invalid notification job payload: userId, type, title, and message are required.`;
      this.logger.error(`[NotificationWorker] Non-retryable error: ${errMessage}`);
      throw new UnrecoverableError(errMessage);
    }

    // 2. Business-level Idempotency Check
    const effectiveIdempotencyKey = idempotencyKey || eventId;
    if (effectiveIdempotencyKey) {
      const existing = await this.prisma.notification.findFirst({
        where: {
          userId,
          type,
          metadata: {
            path: ['idempotencyKey'],
            equals: effectiveIdempotencyKey,
          },
        },
      });

      if (existing) {
        this.logger.log(
          `[NotificationWorker] Idempotency hit: Notification ${existing.id} already exists for user ${userId} [Key: ${effectiveIdempotencyKey}]. Skipping creation.`,
        );
        return { notificationId: existing.id, status: 'already_processed' };
      }
    }

    // 3. Persist notification to PostgreSQL
    const metadataPayload = {
      ...(data || {}),
      ...(effectiveIdempotencyKey && { idempotencyKey: effectiveIdempotencyKey }),
      ...(eventId && { eventId }),
    };

    const notification = await this.prisma.notification.create({
      data: {
        userId,
        type,
        title: title.trim(),
        message: message.trim(),
        metadata: metadataPayload as Prisma.InputJsonValue,
        isRead: false,
      },
    });

    const durationMs = Date.now() - startTime;
    this.logger.log(
      `[NotificationWorker] Notification ${notification.id} created for user ${userId} [${type}] in ${durationMs}ms.`,
    );

    return { notificationId: notification.id, status: 'created' };
  }

  /**
   * Processes fan-out notification to all assigned managers of a hotel property.
   */
  private async processFanoutHotelManagers(
    job: Job<FanoutHotelManagersJobPayload>,
    startTime: number,
  ): Promise<{ dispatchedCount: number; status: 'dispatched' }> {
    const { hotelId, type, title, message, data, idempotencyKey, eventId } = job.data;

    if (!hotelId || !type || !title || !message) {
      const errMessage = `Invalid fanout job payload: hotelId, type, title, and message are required.`;
      this.logger.error(`[NotificationWorker] Non-retryable error: ${errMessage}`);
      throw new UnrecoverableError(errMessage);
    }

    const assignments = await this.prisma.hotelManager.findMany({
      where: { hotelId },
      select: { userId: true },
    });

    if (assignments.length === 0) {
      this.logger.log(`[NotificationWorker] No managers assigned to hotel ${hotelId}. Fan-out complete with 0 dispatches.`);
      return { dispatchedCount: 0, status: 'dispatched' };
    }

    let dispatchedCount = 0;
    for (const assignment of assignments) {
      const managerIdempotencyKey = idempotencyKey
        ? `${idempotencyKey}:${assignment.userId}`
        : eventId
          ? `${eventId}:${assignment.userId}`
          : undefined;

      // Check manager-level idempotency
      if (managerIdempotencyKey) {
        const existing = await this.prisma.notification.findFirst({
          where: {
            userId: assignment.userId,
            type,
            metadata: {
              path: ['idempotencyKey'],
              equals: managerIdempotencyKey,
            },
          },
        });

        if (existing) {
          continue;
        }
      }

      const metadataPayload = {
        ...(data || {}),
        hotelId,
        ...(managerIdempotencyKey && { idempotencyKey: managerIdempotencyKey }),
        ...(eventId && { eventId }),
      };

      await this.prisma.notification.create({
        data: {
          userId: assignment.userId,
          type,
          title: title.trim(),
          message: message.trim(),
          metadata: metadataPayload as Prisma.InputJsonValue,
          isRead: false,
        },
      });
      dispatchedCount++;
    }

    const durationMs = Date.now() - startTime;
    this.logger.log(
      `[NotificationWorker] Fanout completed for hotel ${hotelId}: dispatched ${dispatchedCount}/${assignments.length} manager notifications in ${durationMs}ms.`,
    );

    return { dispatchedCount, status: 'dispatched' };
  }

  /**
   * Returns worker instance for testing or observability.
   */
  getWorker(): Worker {
    return this.worker;
  }

  async onApplicationShutdown(signal?: string): Promise<void> {
    this.logger.log(`Closing NotificationProcessor worker (signal: ${signal})...`);
    if (this.worker) {
      try {
        await this.worker.close();
        this.logger.log('NotificationProcessor worker closed.');
      } catch (err: any) {
        this.logger.warn(`Error closing NotificationProcessor worker: ${err.message}`);
      }
    }
  }
}
