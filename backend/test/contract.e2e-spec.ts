import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import {
  GlobalExceptionFilter,
  TransformInterceptor,
  ApiSuccessResponse,
  ApiErrorResponse,
} from './../src/common';

describe('Stayora API Contract & Hardening (e2e)', () => {
  let app: INestApplication;
  let server: App;
  let openApiDoc: any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // 1. Exact Production Global Configuration
    app.enableCors({
      origin: [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:3002',
      ],
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      credentials: true,
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'X-Request-ID',
        'Idempotency-Key',
        'idempotency-key',
        'Last-Event-ID',
      ],
    });

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

    // 2. Production Swagger OpenAPI Configuration
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Stayora API')
      .setDescription(
        'Stayora Hotel Booking & Reservation Platform — Core REST API Documentation',
      )
      .setVersion('1.0.0')
      .addTag('Health', 'System health and diagnostic endpoints')
      .addTag('Auth', 'Authentication and authorization endpoints')
      .addTag('Hotels & Property Management', 'Hotel property management')
      .addTag('Room Categories & Types', 'Room categories and pricing')
      .addTag('Room Physical Inventory', 'Physical rooms inventory')
      .addTag('Hotel Search & Discovery', 'Search and availability')
      .addTag('Date-Range Inventory Availability', 'Inventory availability')
      .addTag('Reservations & Booking Engine', 'Booking lifecycle')
      .addTag('Payments & Payment Attempts', 'Payment processing')
      .addTag('Reviews & Ratings', 'Guest reviews and ratings')
      .addTag('Notifications', 'In-app notifications')
      .addTag('Realtime / SSE', 'Server-Sent Events')
      .addTag('Admin Operations & Platform Management', 'Admin dashboard & audit logs')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'Authorization',
          in: 'header',
        },
        'JWT-auth',
      )
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'Authorization',
          in: 'header',
        },
        'bearer',
      )
      .build();

    openApiDoc = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, openApiDoc);

    await app.init();
    server = app.getHttpServer() as App;
  });

  afterAll(async () => {
    await app.close();
  });

  // ===========================================================================
  // 1. API Versioning Contract (/api/v1)
  // ===========================================================================

  describe('API Versioning & Route Prefix (/api/v1)', () => {
    it('should reject unversioned requests without /api/v1 prefix with 404', async () => {
      const res = await request(server).get('/hotels').expect(404);
      const body = res.body as ApiErrorResponse;

      expect(body.success).toBe(false);
      expect(body.error.code).toBe('NOT_FOUND');
      expect(body.path).toBe('/hotels');
    });

    it('should accept properly versioned GET /api/v1/health with 200', async () => {
      const res = await request(server).get('/api/v1/health').expect(200);
      const body = res.body as ApiSuccessResponse<any>;

      expect(body.success).toBe(true);
      expect(body.data.status).toBe('ok');
      expect(body.data.service).toBe('stayora-api');
    });

    it('should accept properly versioned public GET /api/v1/hotels with 200', async () => {
      const res = await request(server).get('/api/v1/hotels').expect(200);
      const body = res.body as ApiSuccessResponse<any>;

      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
    });
  });

  // ===========================================================================
  // 2. Swagger / OpenAPI Documentation Contract
  // ===========================================================================

  describe('Swagger / OpenAPI Contract', () => {
    it('should generate valid OpenAPI 3.0 specification', () => {
      expect(openApiDoc).toBeDefined();
      expect(openApiDoc.openapi).toMatch(/^3\./);
      expect(openApiDoc.info.title).toBe('Stayora API');
      expect(openApiDoc.info.version).toBe('1.0.0');
    });

    it('should declare security schemes for Bearer JWT authentication', () => {
      expect(openApiDoc.components?.securitySchemes).toBeDefined();
      expect(openApiDoc.components.securitySchemes['JWT-auth']).toEqual(
        expect.objectContaining({
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        }),
      );
    });

    it('should document all core platform REST endpoint paths', () => {
      const paths = Object.keys(openApiDoc.paths);

      // Auth
      expect(paths).toContain('/api/v1/auth/customer/register');
      expect(paths).toContain('/api/v1/auth/customer/login');
      expect(paths).toContain('/api/v1/auth/manager/login');
      expect(paths).toContain('/api/v1/auth/admin/login');
      expect(paths).toContain('/api/v1/auth/me');

      // Hotels & Inventory
      expect(paths).toContain('/api/v1/hotels');
      expect(paths).toContain('/api/v1/hotels/{id}');
      expect(paths).toContain('/api/v1/room-types');
      expect(paths).toContain('/api/v1/rooms');

      // Search & Availability
      expect(paths).toContain('/api/v1/search/hotels');
      expect(paths).toContain('/api/v1/availability/hotels/{hotelId}');

      // Bookings & Payments
      expect(paths).toContain('/api/v1/bookings');
      expect(paths).toContain('/api/v1/bookings/{id}');
      expect(paths).toContain('/api/v1/bookings/{id}/cancel');
      expect(paths).toContain('/api/v1/bookings/{id}/check-in');
      expect(paths).toContain('/api/v1/bookings/{id}/check-out');
      expect(paths).toContain('/api/v1/payments');

      // Reviews & Notifications
      expect(paths).toContain('/api/v1/reviews');
      expect(paths).toContain('/api/v1/notifications');
      expect(paths).toContain('/api/v1/notifications/unread-count');

      // Realtime SSE
      expect(paths).toContain('/api/v1/events/stream');

      // Admin & Audit
      expect(paths).toContain('/api/v1/admin/dashboard');
      expect(paths).toContain('/api/v1/admin/users');
      expect(paths).toContain('/api/v1/admin/hotels');
      expect(paths).toContain('/api/v1/admin/bookings');
      expect(paths).toContain('/api/v1/admin/audit-logs');
      expect(paths).toContain('/api/v1/admin/audit-logs/{id}');
    });
  });

  // ===========================================================================
  // 3. Error Contract & Validation Consistency
  // ===========================================================================

  describe('Standardized Error Response Envelope', () => {
    it('should return standardized 401 UNAUTHORIZED envelope when token is missing', async () => {
      const res = await request(server).get('/api/v1/auth/me').expect(401);
      const body = res.body as ApiErrorResponse;

      expect(body).toEqual({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: expect.any(String),
        },
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        path: '/api/v1/auth/me',
      });
    });

    it('should return standardized 400 VALIDATION_ERROR envelope on invalid DTO payload', async () => {
      const res = await request(server)
        .post('/api/v1/auth/customer/register')
        .send({
          email: 'not-an-email',
          password: '123', // too short
        })
        .expect(400);

      const body = res.body as ApiErrorResponse;

      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toBe('Request validation failed');
      expect(Array.isArray(body.error.details)).toBe(true);
      expect(body.error.details!.length).toBeGreaterThan(0);
      expect(body.timestamp).toBeDefined();
      expect(body.path).toBe('/api/v1/auth/customer/register');
    });

    it('should reject unknown extra parameters with forbidNonWhitelisted 400', async () => {
      const res = await request(server)
        .post('/api/v1/auth/customer/login')
        .send({
          email: 'test@example.com',
          password: 'Password123!',
          injectedField: 'malicious',
        })
        .expect(400);

      const body = res.body as ApiErrorResponse;
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(
        (body.error.details as string[]).some((msg) =>
          msg.includes('property injectedField should not exist'),
        ),
      ).toBe(true);
    });

    it('should never expose database error details or SQL queries in error responses', async () => {
      const res = await request(server)
        .get('/api/v1/hotels/00000000-0000-0000-0000-000000000000')
        .expect(404);

      const body = res.body as ApiErrorResponse;
      const serialized = JSON.stringify(body);

      expect(serialized).not.toContain('prisma');
      expect(serialized).not.toContain('SELECT');
      expect(serialized).not.toContain('postgresql');
      expect(serialized).not.toContain('DATABASE_URL');
    });
  });

  // ===========================================================================
  // 4. Pagination & Query Parameters Contract
  // ===========================================================================

  describe('Pagination Contract & Allowed Sorting', () => {
    it('should enforce limit bounds: reject limit > 100 with 400', async () => {
      const res = await request(server)
        .get('/api/v1/hotels?limit=500')
        .expect(400);

      const body = res.body as ApiErrorResponse;
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(
        (body.error.details as string[]).some((msg) =>
          msg.includes('limit must not be greater than 100'),
        ),
      ).toBe(true);
    });

    it('should enforce page bounds: reject page < 1 with 400', async () => {
      const res = await request(server)
        .get('/api/v1/hotels?page=0')
        .expect(400);

      const body = res.body as ApiErrorResponse;
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(
        (body.error.details as string[]).some((msg) =>
          msg.includes('page must not be less than 1'),
        ),
      ).toBe(true);
    });

    it('should reject unwhitelisted sort fields with 400', async () => {
      const res = await request(server)
        .get('/api/v1/hotels?sortBy=nonExistentDatabaseColumn')
        .expect(400);

      const body = res.body as ApiErrorResponse;
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return consistent pagination envelope for collection queries', async () => {
      const res = await request(server)
        .get('/api/v1/hotels?page=1&limit=5')
        .expect(200);

      const body = res.body as ApiSuccessResponse<{
        items: any[];
        meta: {
          total: number;
          page: number;
          limit: number;
          totalPages: number;
        };
      }>;

      expect(body.success).toBe(true);
      expect(Array.isArray(body.data.items)).toBe(true);
      expect(body.data.meta).toBeDefined();
      expect(typeof body.data.meta.total).toBe('number');
      expect(body.data.meta.page).toBe(1);
      expect(body.data.meta.limit).toBe(5);
      expect(typeof body.data.meta.totalPages).toBe('number');
    });
  });

  // ===========================================================================
  // 5. CORS Headers & Idempotency Header Contract
  // ===========================================================================

  describe('CORS & Idempotency Header Handling', () => {
    it('should allow CORS preflight with Idempotency-Key from frontend origins', async () => {
      const res = await request(server)
        .options('/api/v1/payments')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')
        .set(
          'Access-Control-Request-Headers',
          'Content-Type, Authorization, Idempotency-Key',
        )
        .expect(204);

      expect(res.headers['access-control-allow-origin']).toBe(
        'http://localhost:3000',
      );
      expect(res.headers['access-control-allow-headers']).toMatch(
        /Idempotency-Key/i,
      );
    });
  });

  // ===========================================================================
  // 6. Sensitive Field Protection (Zero Credential Leakage)
  // ===========================================================================

  describe('Sensitive Data Protection', () => {
    it('should never expose passwordHash in any public or authenticated response', async () => {
      const email = `audit-test-${Date.now()}@example.com`;
      const res = await request(server)
        .post('/api/v1/auth/customer/register')
        .send({
          email,
          password: 'Password123!',
          firstName: 'Audit',
          lastName: 'Tester',
        })
        .expect(201);

      const serialized = JSON.stringify(res.body);
      expect(serialized).not.toContain('passwordHash');
      expect(serialized).not.toContain('tokenHash');
      expect(res.body.data.user.passwordHash).toBeUndefined();
    });
  });

  // ===========================================================================
  // 7. Audit Log API Contract
  // ===========================================================================

  describe('Audit Log API Contract (GET /api/v1/admin/audit-logs)', () => {
    let customerToken: string;
    let adminToken: string;

    beforeAll(async () => {
      // Customer Token
      const resCust = await request(server)
        .post('/api/v1/auth/customer/login')
        .send({ email: 'customer@stayora.com', password: 'Password123!' });
      customerToken = resCust.body?.data?.accessToken;

      // Admin Token
      const resAdmin = await request(server)
        .post('/api/v1/auth/admin/login')
        .send({ email: 'admin@stayora.com', password: 'Password123!' });
      adminToken = resAdmin.body?.data?.accessToken;
    });

    it('should reject unauthenticated requests with 401', async () => {
      const res = await request(server)
        .get('/api/v1/admin/audit-logs')
        .expect(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject non-admin roles (customer) with 403 FORBIDDEN', async () => {
      const res = await request(server)
        .get('/api/v1/admin/audit-logs')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should allow admin to retrieve paginated audit logs with 200', async () => {
      const res = await request(server)
        .get('/api/v1/admin/audit-logs?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const body = res.body as ApiSuccessResponse<{
        items: any[];
        meta: { page: number; limit: number; total: number; totalPages: number };
      }>;

      expect(body.success).toBe(true);
      expect(Array.isArray(body.data.items)).toBe(true);
      expect(body.data.meta).toBeDefined();
      expect(body.data.meta.page).toBe(1);
      expect(body.data.meta.limit).toBe(10);
      expect(typeof body.data.meta.total).toBe('number');
    });

    it('should return 404 with AUDIT_LOG_NOT_FOUND for non-existent audit log ID', async () => {
      const res = await request(server)
        .get('/api/v1/admin/audit-logs/00000000-0000-4000-8000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('AUDIT_LOG_NOT_FOUND');
    });
  });
});

