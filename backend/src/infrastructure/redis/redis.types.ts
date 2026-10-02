export interface RedisConfigOptions {
  host: string;
  port: number;
  password?: string;
  db?: number;
  url?: string;
}

export interface CacheWrapOptions {
  ttlSeconds?: number;
  tags?: string[];
}

export type RedisHealthStatus = 'up' | 'down';
