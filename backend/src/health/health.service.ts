import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../infrastructure/redis/redis.service';
import { QueueService } from '../infrastructure/queues/queue.service';

export interface HealthData {
  status: 'ok' | 'degraded' | 'down';
  service: string;
  environment: string;
  timestamp: string;
  services: {
    database: 'up' | 'down';
    redis: 'up' | 'down';
    queues: 'up' | 'down';
  };
}

@Injectable()
export class HealthService {
  constructor(
    private readonly configService: ConfigService,
    @Optional() private readonly prisma?: PrismaService,
    @Optional() private readonly redisService?: RedisService,
    @Optional() private readonly queueService?: QueueService,
  ) {}

  async getHealth(): Promise<HealthData> {
    let dbStatus: 'up' | 'down' = 'down';
    try {
      if (this.prisma) {
        await this.prisma.$queryRaw`SELECT 1`;
        dbStatus = 'up';
      } else {
        dbStatus = 'up';
      }
    } catch {
      dbStatus = 'down';
    }

    let redisStatus: 'up' | 'down' = 'down';
    try {
      if (this.redisService) {
        const isHealthy = await this.redisService.isHealthy();
        redisStatus = isHealthy ? 'up' : 'down';
      } else {
        redisStatus = 'up';
      }
    } catch {
      redisStatus = 'down';
    }

    let queuesStatus: 'up' | 'down' = 'down';
    try {
      if (this.queueService) {
        const isHealthy = await this.queueService.isHealthy();
        queuesStatus = isHealthy ? 'up' : 'down';
      } else {
        queuesStatus = 'up';
      }
    } catch {
      queuesStatus = 'down';
    }

    let status: 'ok' | 'degraded' | 'down' = 'ok';
    if (dbStatus !== 'up') {
      status = 'down';
    } else if (redisStatus !== 'up' || queuesStatus !== 'up') {
      // Degraded operational model:
      // PostgreSQL is the single source of truth. Redis and BullMQ are supporting infrastructure.
      // If Redis or queues are unavailable, the application degrades performance gracefully to direct DB access.
      status = 'degraded';
    }

    return {
      status,
      service: 'stayora-api',
      environment: this.configService.get<string>('env', 'development'),
      timestamp: new Date().toISOString(),
      services: {
        database: dbStatus,
        redis: redisStatus,
        queues: queuesStatus,
      },
    };
  }
}

