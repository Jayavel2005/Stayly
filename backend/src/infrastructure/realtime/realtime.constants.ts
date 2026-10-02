import { RealtimeEventType } from './realtime.events';

export const REALTIME_CONFIG = {
  /**
   * Heartbeat interval in milliseconds to keep SSE stream open across proxies.
   */
  DEFAULT_HEARTBEAT_INTERVAL_MS: 30000,

  /**
   * Maximum concurrent SSE connections permitted per user.
   * If exceeded, the oldest connection is closed to prevent resource exhaustion.
   */
  DEFAULT_MAX_CONNECTIONS_PER_USER: 5,

  /**
   * Client reconnection retry hint in milliseconds sent in SSE stream.
   */
  DEFAULT_RETRY_MS: 5000,
} as const;

/**
   * Explicit allowlist of event types permitted for broadcast to Admin connections.
   * Prevents noisy operational data or sensitive personal details from streaming to admin streams.
   */
export const ADMIN_ALLOWED_EVENT_TYPES: ReadonlySet<RealtimeEventType> = new Set([
  RealtimeEventType.BOOKING_CREATED,
  RealtimeEventType.BOOKING_CONFIRMED,
  RealtimeEventType.BOOKING_CANCELLED,
  RealtimeEventType.PAYMENT_COMPLETED,
  RealtimeEventType.PAYMENT_FAILED,
  RealtimeEventType.CHECKED_IN,
  RealtimeEventType.CHECKED_OUT,
  RealtimeEventType.NOTIFICATION_CREATED,
  RealtimeEventType.HOTEL_STATUS_CHANGED,
  RealtimeEventType.USER_STATUS_CHANGED,
  RealtimeEventType.MANAGER_ASSIGNMENT_CHANGED,
]);
