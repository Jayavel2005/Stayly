export const REDIS_CLIENT = 'REDIS_CLIENT';

export const REDIS_TTL = {
  SHORT: 60, // 1 minute (e.g. search filters, transient counts)
  MEDIUM: 300, // 5 minutes (e.g. hotel details, room type summaries)
  LONG: 3600, // 1 hour (e.g. static catalog metadata)
  DAY: 86400, // 24 hours
} as const;

export const REDIS_NAMESPACES = {
  CACHE: 'cache',
  TEMP: 'temp',
  LOCK: 'lock',
  RATE_LIMIT: 'rate-limit',
} as const;
