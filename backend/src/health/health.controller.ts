import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HealthService } from './health.service';
import type { HealthData } from './health.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'System health check endpoint' })
  @ApiResponse({
    status: 200,
    description: 'System health check succeeded',
    schema: {
      example: {
        success: true,
        data: {
          status: 'ok',
          service: 'stayora-api',
          environment: 'development',
          timestamp: '2026-10-01T10:00:00.000Z',
          services: {
            database: 'up',
            redis: 'up',
          },
        },
      },
    },
  })
  async check(): Promise<HealthData> {
    return this.healthService.getHealth();
  }
}
