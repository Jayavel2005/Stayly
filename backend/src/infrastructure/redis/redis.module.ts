import { Module, Global, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): Redis => {
        const logger = new Logger('RedisClient');
        const redisUrl = configService.get<string>('redis.url');
        const host = configService.get<string>('redis.host', 'localhost');
        const port = configService.get<number>('redis.port', 6379);
        const password = configService.get<string>('redis.password');
        const db = configService.get<number>('redis.db', 0);

        let client: Redis;

        const options = {
          retryStrategy(times: number) {
            const delay = Math.min(times * 100, 3000);
            return delay;
          },
          maxRetriesPerRequest: 3,
          enableReadyCheck: true,
          reconnectOnError(err: Error) {
            const targetError = 'READONLY';
            if (err.message.includes(targetError)) {
              return true;
            }
            return false;
          },
        };

        if (redisUrl) {
          client = new Redis(redisUrl, options);
        } else {
          client = new Redis({
            host,
            port,
            password: password || undefined,
            db,
            ...options,
          });
        }

        client.on('connect', () => {
          logger.log(`Connecting to Redis at ${host}:${port}...`);
        });

        client.on('ready', () => {
          logger.log('Redis client connected and ready.');
        });

        client.on('error', (err) => {
          logger.warn(`Redis connection warning/error: ${err.message}`);
        });

        client.on('reconnecting', () => {
          logger.warn('Redis client reconnecting...');
        });

        client.on('close', () => {
          logger.log('Redis connection closed.');
        });

        return client;
      },
    },
    RedisService,
  ],
  exports: [REDIS_CLIENT, RedisService],
})
export class RedisModule {}
