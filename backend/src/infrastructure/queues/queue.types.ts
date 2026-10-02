export enum NotificationJobName {
  SEND_NOTIFICATION = 'send-notification',
  FANOUT_HOTEL_MANAGERS = 'fanout-hotel-managers',
}

export enum CleanupJobName {
  EXPIRED_BOOKINGS = 'cleanup-expired-bookings',
}

export interface SendNotificationJobPayload {
  userId: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown> | null;
  idempotencyKey?: string;
  eventId?: string;
}

export interface FanoutHotelManagersJobPayload {
  hotelId: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown> | null;
  idempotencyKey?: string;
  eventId?: string;
}

export interface CleanupExpiredBookingsJobPayload {
  triggeredAt?: string;
  scheduled?: boolean;
}

export interface QueueJobCounts {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}
