export const QUEUE_NAMES = {
  NOTIFICATIONS: 'notifications',
  CLEANUP: 'cleanup',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export const QUEUE_OPTIONS = {
  DEFAULT_ATTEMPTS: 3,
  BACKOFF_DELAY: 1000,
  WORKER_CONCURRENCY: {
    NOTIFICATIONS: 5,
    CLEANUP: 1,
  },
  COMPLETED_JOB_RETENTION: {
    age: 3600, // 1 hour
    count: 100,
  },
  FAILED_JOB_RETENTION: {
    age: 86400 * 3, // 3 days
    count: 500,
  },
  CLEANUP_INTERVAL_MS: 60 * 1000, // 1 minute
} as const;
