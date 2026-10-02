import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { RedisService } from '../src/infrastructure/redis/redis.service';
import { RedisKeys } from '../src/infrastructure/redis/redis-keys';
import { PrismaService } from '../src/prisma/prisma.service';
import { GlobalExceptionFilter, TransformInterceptor } from '../src/common';

describe('Redis Infrastructure & Cache Integration (e2e)', () => {
  let app: INestApplication;
  let server: App;
  let redisService: RedisService;
  let prisma: PrismaService;
  let managerToken: string;
  let seededHotelId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );

    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor());

    await app.init();
    server = app.getHttpServer() as App;
    redisService = app.get<RedisService>(RedisService);
    prisma = app.get<PrismaService>(PrismaService);

    // Login manager to test cache invalidation on update
    const managerLogin = await request(server)
      .post('/api/v1/auth/manager/login')
      .send({ email: 'manager@stayora.com', password: 'Password123!' });
    managerToken = managerLogin.body.data.accessToken;

    // Get seeded hotel
    const hotel = await prisma.hotel.findFirst({
      where: { slug: 'stayora-grand-palace' },
    });
    if (!hotel) {
      throw new Error('Seeded hotel not found');
    }
    seededHotelId = hotel.id;
  });

  afterAll(async () => {
    // Clean up test keys
    const testPattern = RedisKeys.pattern('test');
    await redisService.deleteByPattern(testPattern);
    await redisService.delete(RedisKeys.hotel(seededHotelId));
    await app.close();
  });

  describe('Health Endpoint with Redis Integration', () => {
    it('GET /api/v1/health should return ok and services status with database and redis up', async () => {
      const response = await request(server).get('/api/v1/health').expect(200);

      expect(response.body).toEqual({
        success: true,
        data: expect.objectContaining({
          status: 'ok',
          service: 'stayora-api',
          environment: expect.any(String),
          timestamp: expect.any(String),
          services: expect.objectContaining({
            database: 'up',
            redis: 'up',
          }),
        }),
      });
    });
  });

  describe('Redis Core Operations & Lifecycle', () => {
    it('should ping Redis and report healthy', async () => {
      const ping = await redisService.ping();
      expect(ping).toBe('PONG');
      const isHealthy = await redisService.isHealthy();
      expect(isHealthy).toBe(true);
    });

    it('should set and get complex JSON object', async () => {
      const testKey = RedisKeys.custom('test', 'object-key');
      const testData = {
        name: 'Presidential Suite',
        rateCents: 50000,
        amenities: ['Jacuzzi', 'Ocean View', 'Butler'],
        active: true,
      };

      await redisService.set(testKey, testData, 30);
      const retrieved = await redisService.get<typeof testData>(testKey);

      expect(retrieved).toEqual(testData);
      await redisService.delete(testKey);
    });

    it('should expire keys automatically after TTL', async () => {
      const testKey = RedisKeys.custom('test', 'ttl-key');
      await redisService.set(testKey, { temp: true }, 1); // 1 second TTL

      expect(await redisService.exists(testKey)).toBe(true);

      // Wait 1.2s for TTL expiration
      await new Promise((resolve) => setTimeout(resolve, 1200));

      expect(await redisService.exists(testKey)).toBe(false);
      const expiredValue = await redisService.get(testKey);
      expect(expiredValue).toBeNull();
    });

    it('should support atomic increment and decrement', async () => {
      const counterKey = RedisKeys.custom('test', 'counter');
      await redisService.delete(counterKey);

      const count1 = await redisService.increment(counterKey, 5);
      expect(count1).toBe(5);

      const count2 = await redisService.decrement(counterKey, 2);
      expect(count2).toBe(3);

      await redisService.delete(counterKey);
    });

    it('should delete keys matching a pattern using SCAN', async () => {
      const key1 = RedisKeys.custom('test-batch', '1');
      const key2 = RedisKeys.custom('test-batch', '2');
      const otherKey = RedisKeys.custom('other', '1');

      await redisService.set(key1, 'v1', 30);
      await redisService.set(key2, 'v2', 30);
      await redisService.set(otherKey, 'keep', 30);

      await redisService.deleteByPattern(RedisKeys.pattern('test-batch'));

      expect(await redisService.exists(key1)).toBe(false);
      expect(await redisService.exists(key2)).toBe(false);
      expect(await redisService.exists(otherKey)).toBe(true);

      await redisService.delete(otherKey);
    });
  });

  describe('Cache-Aside Pattern & Invalidation (Hotels)', () => {
    it('should populate Redis on first public hotel fetch and serve from cache', async () => {
      const cacheKey = RedisKeys.hotel(seededHotelId);
      // Ensure clean slate in Redis
      await redisService.delete(cacheKey);
      expect(await redisService.exists(cacheKey)).toBe(false);

      // 1. Initial request (Cache Miss -> DB -> Redis SET)
      const res1 = await request(server)
        .get(`/api/v1/hotels/${seededHotelId}`)
        .expect(200);

      expect(res1.body.success).toBe(true);
      expect(res1.body.data.id).toBe(seededHotelId);

      // Verify that Redis now contains the cached hotel
      const cached = await redisService.get<any>(cacheKey);
      expect(cached).not.toBeNull();
      expect(cached.id).toBe(seededHotelId);
      expect(cached.name).toBe(res1.body.data.name);

      // 2. Second request (Cache Hit)
      const res2 = await request(server)
        .get(`/api/v1/hotels/${seededHotelId}`)
        .expect(200);

      expect(res2.body.data.id).toBe(seededHotelId);
      expect(res2.body.data.name).toBe(res1.body.data.name);
    });

    it('should invalidate Redis cache when manager updates hotel property', async () => {
      const cacheKey = RedisKeys.hotel(seededHotelId);

      // Ensure key is cached first
      await request(server)
        .get(`/api/v1/hotels/${seededHotelId}`)
        .expect(200);

      expect(await redisService.exists(cacheKey)).toBe(true);

      // Manager updates description
      const updatedDescription = 'Updated description via e2e test at ' + Date.now();
      await request(server)
        .patch(`/api/v1/manager/hotels/${seededHotelId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ description: updatedDescription })
        .expect(200);

      // Cache key must have been invalidated (deleted)
      const existsAfterUpdate = await redisService.exists(cacheKey);
      expect(existsAfterUpdate).toBe(false);

      // Next public fetch should retrieve updated data from DB and recache
      const resUpdated = await request(server)
        .get(`/api/v1/hotels/${seededHotelId}`)
        .expect(200);

      expect(resUpdated.body.data.description).toBe(updatedDescription);
      expect(await redisService.exists(cacheKey)).toBe(true);
    });

    it('should gracefully handle corrupt JSON in cache and fallback to DB', async () => {
      const cacheKey = RedisKeys.hotel(seededHotelId);

      // Directly poison the cache with malformed non-JSON data using raw client
      await redisService.getClient().set(cacheKey, '<<<malformed-json-corrupt>>>');

      // Request must still succeed via DB fallback, not crash with 500
      const response = await request(server)
        .get(`/api/v1/hotels/${seededHotelId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(seededHotelId);

      // Verify the corrupt key was evicted
      const rawValue = await redisService.getClient().get(cacheKey);
      // Either re-cached with valid JSON or cleared
      if (rawValue) {
        expect(() => JSON.parse(rawValue)).not.toThrow();
      }
    });
  });
});
