import { Injectable, Inject, Logger, OnApplicationShutdown } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT, REDIS_TTL } from './redis.constants';

@Injectable()
export class RedisService implements OnApplicationShutdown {
  private readonly logger = new Logger(RedisService.name);

  constructor(
    @Inject(REDIS_CLIENT)
    private readonly client: Redis,
  ) {}

  /**
   * Retrieves a cached value and safely parses JSON.
   * On cache miss, malformed data, or Redis network failure, gracefully returns null.
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.client.get(key);
      if (raw === null || raw === undefined) {
        return null;
      }

      try {
        return JSON.parse(raw) as T;
      } catch (parseError) {
        this.logger.warn(
          `Corrupted JSON cache entry for key "${key}". Evicting corrupt key. Error: ${(parseError as Error).message}`,
        );
        // Clean up corrupt cache entry asynchronously
        this.delete(key).catch(() => {});
        return null;
      }
    } catch (redisError) {
      this.logger.warn(
        `Redis GET failed for key "${key}". Falling back gracefully. Error: ${(redisError as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Serializes a value as JSON and stores it with an optional TTL (in seconds).
   */
  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      const effectiveTtl = ttlSeconds !== undefined ? ttlSeconds : REDIS_TTL.MEDIUM;

      if (effectiveTtl > 0) {
        await this.client.set(key, serialized, 'EX', effectiveTtl);
      } else {
        await this.client.set(key, serialized);
      }
    } catch (redisError) {
      this.logger.warn(
        `Redis SET failed for key "${key}". Proceeding without cache. Error: ${(redisError as Error).message}`,
      );
    }
  }

  /**
   * Deletes a specific cache key.
   */
  async delete(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (redisError) {
      this.logger.warn(
        `Redis DEL failed for key "${key}". Error: ${(redisError as Error).message}`,
      );
    }
  }

  /**
   * Non-blocking invalidation of keys matching a pattern using SCAN.
   */
  async deleteByPattern(pattern: string): Promise<void> {
    try {
      let cursor = '0';
      do {
        const [nextCursor, keys] = await this.client.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100,
        );
        cursor = nextCursor;

        if (keys.length > 0) {
          await this.client.del(...keys);
        }
      } while (cursor !== '0');
    } catch (redisError) {
      this.logger.warn(
        `Redis deleteByPattern failed for pattern "${pattern}". Error: ${(redisError as Error).message}`,
      );
    }
  }

  /**
   * Checks if a key exists in Redis.
   */
  async exists(key: string): Promise<boolean> {
    try {
      const count = await this.client.exists(key);
      return count > 0;
    } catch (redisError) {
      this.logger.warn(
        `Redis EXISTS failed for key "${key}". Error: ${(redisError as Error).message}`,
      );
      return false;
    }
  }

  /**
   * Sets TTL on an existing key.
   */
  async expire(key: string, ttlSeconds: number): Promise<void> {
    try {
      await this.client.expire(key, ttlSeconds);
    } catch (redisError) {
      this.logger.warn(
        `Redis EXPIRE failed for key "${key}". Error: ${(redisError as Error).message}`,
      );
    }
  }

  /**
   * Increments an integer counter key.
   */
  async increment(key: string, amount = 1): Promise<number> {
    try {
      return await this.client.incrby(key, amount);
    } catch (redisError) {
      this.logger.warn(
        `Redis INCRBY failed for key "${key}". Error: ${(redisError as Error).message}`,
      );
      throw redisError;
    }
  }

  /**
   * Decrements an integer counter key.
   */
  async decrement(key: string, amount = 1): Promise<number> {
    try {
      return await this.client.decrby(key, amount);
    } catch (redisError) {
      this.logger.warn(
        `Redis DECRBY failed for key "${key}". Error: ${(redisError as Error).message}`,
      );
      throw redisError;
    }
  }

  /**
   * Executes a PING command to verify Redis connectivity.
   */
  async ping(): Promise<string> {
    return this.client.ping();
  }

  /**
   * High-level Cache-Aside wrapper.
   * 1. Attempts to fetch from Redis cache.
   * 2. On cache hit, returns cached data immediately.
   * 3. On cache miss or Redis error, executes database loader function `fn()`.
   * 4. Asynchronously caches the result with the given TTL and returns data.
   */
  async wrap<T>(
    key: string,
    fn: () => Promise<T>,
    ttlSeconds: number = REDIS_TTL.MEDIUM,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null && cached !== undefined) {
      return cached;
    }

    const result = await fn();

    if (result !== null && result !== undefined) {
      // Store in Redis (non-blocking fallback handled inside set)
      await this.set(key, result, ttlSeconds);
    }

    return result;
  }

  /**
   * Performs a lightweight health check returning boolean status.
   */
  async isHealthy(): Promise<boolean> {
    try {
      const res = await this.client.ping();
      return res === 'PONG';
    } catch {
      return false;
    }
  }

  /**
   * Access underlying raw ioredis instance if specialized operations are required.
   */
  getClient(): Redis {
    return this.client;
  }

  /**
   * Gracefully close Redis client connection during application shutdown.
   */
  async onApplicationShutdown(signal?: string): Promise<void> {
    this.logger.log(`Closing Redis connection on application shutdown (signal: ${signal})...`);
    try {
      if (this.client.status === 'ready' || this.client.status === 'connecting') {
        await this.client.quit();
      }
    } catch (err) {
      this.logger.warn(`Error during Redis client disconnect: ${(err as Error).message}`);
    }
  }
}
