import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface HealthData {
  status: string;
  service: string;
  environment: string;
  timestamp: string;
}

@Injectable()
export class HealthService {
  constructor(private readonly configService: ConfigService) {}

  getHealth(): HealthData {
    return {
      status: 'ok',
      service: 'stayora-api',
      environment: this.configService.get<string>('env', 'development'),
      timestamp: new Date().toISOString(),
    };
  }
}
