import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  let controller: HealthController;
  let service: HealthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        HealthService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test'),
          },
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    service = module.get<HealthService>(HealthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
    expect(service).toBeDefined();
  });

  it('should return health status data with services', async () => {
    const result = await controller.check();
    expect(result).toHaveProperty('status', 'ok');
    expect(result).toHaveProperty('service', 'stayora-api');
    expect(result).toHaveProperty('environment', 'test');
    expect(result).toHaveProperty('timestamp');
    expect(result.services).toEqual({
      database: 'up',
      redis: 'up',
    });
  });

  it('should report degraded status when Redis is down but database is up', async () => {
    const mockPrisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ 1: 1 }]),
    };
    const mockRedis = {
      isHealthy: jest.fn().mockResolvedValue(false),
    };

    const degradedService = new HealthService(
      { get: jest.fn().mockReturnValue('test') } as any,
      mockPrisma as any,
      mockRedis as any,
    );

    const result = await degradedService.getHealth();
    expect(result.status).toBe('degraded');
    expect(result.services).toEqual({
      database: 'up',
      redis: 'down',
    });
  });

  it('should report down status when database is down', async () => {
    const mockPrisma = {
      $queryRaw: jest.fn().mockRejectedValue(new Error('DB Connection Refused')),
    };
    const mockRedis = {
      isHealthy: jest.fn().mockResolvedValue(true),
    };

    const downService = new HealthService(
      { get: jest.fn().mockReturnValue('test') } as any,
      mockPrisma as any,
      mockRedis as any,
    );

    const result = await downService.getHealth();
    expect(result.status).toBe('down');
    expect(result.services).toEqual({
      database: 'down',
      redis: 'up',
    });
  });
});
