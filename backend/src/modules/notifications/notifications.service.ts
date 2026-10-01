import { Injectable, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DomainException } from '../../common/exceptions/domain.exception';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import { CreateNotificationPayload } from './dto/create-notification.dto';
import {
  NotificationResponse,
  PaginatedNotificationsResponse,
  UnreadCountResponse,
} from './types/notification-response.type';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Internal Backend Notification Dispatcher.
   * Persists a notification to PostgreSQL.
   */
  async create(payload: CreateNotificationPayload): Promise<NotificationResponse> {
    try {
      const notification = await this.prisma.notification.create({
        data: {
          userId: payload.userId,
          type: payload.type,
          title: payload.title.trim(),
          message: payload.message.trim(),
          metadata: payload.data ?? Prisma.JsonNull,
          isRead: false,
        },
      });

      this.logger.log(
        `[NotificationsService] Notification ${notification.id} created for user ${payload.userId} [${payload.type}]`,
      );

      return this.mapToNotificationResponse(notification);
    } catch (error: any) {
      this.logger.error(
        `[NotificationsService] Failed to persist notification for user ${payload.userId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Internal Helper: Dispatches a notification to all managers assigned to a specific hotel property.
   * Guarantees manager tenant isolation by querying the hotel_managers join table.
   */
  async createForManagersOfHotel(
    hotelId: string,
    payload: Omit<CreateNotificationPayload, 'userId'>,
  ): Promise<number> {
    try {
      const assignments = await this.prisma.hotelManager.findMany({
        where: { hotelId },
        select: { userId: true },
      });

      if (assignments.length === 0) {
        return 0;
      }

      await Promise.all(
        assignments.map((assignment) =>
          this.create({
            ...payload,
            userId: assignment.userId,
          }).catch((err) => {
            this.logger.warn(
              `[NotificationsService] Could not send manager notification to ${assignment.userId}: ${err.message}`,
            );
          }),
        ),
      );

      return assignments.length;
    } catch (error: any) {
      this.logger.warn(
        `[NotificationsService] Failed to notify managers for hotel ${hotelId}: ${error.message}`,
      );
      return 0;
    }
  }

  /**
   * Retrieves paginated notifications for the authenticated user.
   * Performs database-level pagination, sorting, and unread filtering.
   */
  async getUserNotifications(
    userId: string,
    query: QueryNotificationsDto,
  ): Promise<PaginatedNotificationsResponse> {
    const where: Prisma.NotificationWhereInput = {
      userId,
    };

    if (query.isRead !== undefined) {
      where.isRead = query.isRead;
    }

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const orderBy: Prisma.NotificationOrderByWithRelationInput =
      query.sortBy === 'oldest' ? { createdAt: 'asc' } : { createdAt: 'desc' };

    const [total, unreadCount, items] = await Promise.all([
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, isRead: false } }),
      this.prisma.notification.findMany({
        where,
        orderBy,
        skip,
        take: limit,
      }),
    ]);

    return {
      items: items.map((item) => this.mapToNotificationResponse(item)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
        unreadCount,
      },
    };
  }

  /**
   * Retrieves the unread notification count for the authenticated user.
   */
  async getUnreadCount(userId: string): Promise<UnreadCountResponse> {
    const count = await this.prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });

    return { count };
  }

  /**
   * Retrieves a single notification by ID.
   * Strictly enforces user ownership (IDOR defense).
   */
  async getNotificationById(
    userId: string,
    id: string,
  ): Promise<NotificationResponse> {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });

    if (!notification || notification.userId !== userId) {
      throw new DomainException(
        'NOTIFICATION_NOT_FOUND',
        'Notification not found.',
        HttpStatus.NOT_FOUND,
      );
    }

    return this.mapToNotificationResponse(notification);
  }

  /**
   * Marks a single notification as read.
   * Idempotent: repeated invocations succeed safely without modifying readAt once set.
   */
  async markAsRead(
    userId: string,
    id: string,
  ): Promise<NotificationResponse> {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });

    if (!notification || notification.userId !== userId) {
      throw new DomainException(
        'NOTIFICATION_NOT_FOUND',
        'Notification not found.',
        HttpStatus.NOT_FOUND,
      );
    }

    if (notification.isRead) {
      return this.mapToNotificationResponse(notification);
    }

    const updated = await this.prisma.notification.update({
      where: { id },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    this.logger.log(`[NotificationsService] Notification ${id} marked as read by user ${userId}`);
    return this.mapToNotificationResponse(updated);
  }

  /**
   * Marks all unread notifications for the authenticated user as read.
   * Safe and idempotent across repeated calls.
   */
  async markAllAsRead(
    userId: string,
  ): Promise<{ success: boolean; count: number; message: string }> {
    const result = await this.prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    this.logger.log(
      `[NotificationsService] Marked ${result.count} notifications as read for user ${userId}`,
    );

    return {
      success: true,
      count: result.count,
      message: 'All notifications marked as read.',
    };
  }

  /**
   * Transforms raw Prisma notification record to explicit client-facing DTO.
   */
  private mapToNotificationResponse(notification: any): NotificationResponse {
    return {
      id: notification.id,
      userId: notification.userId,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      data: notification.metadata ?? null,
      isRead: notification.isRead,
      readAt: notification.readAt ? notification.readAt.toISOString() : null,
      createdAt: notification.createdAt.toISOString(),
    };
  }
}
