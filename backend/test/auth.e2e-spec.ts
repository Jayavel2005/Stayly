import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { GlobalExceptionFilter, TransformInterceptor } from '../src/common';
import { JwtService } from '@nestjs/jwt';

describe('Authentication Flow (e2e)', () => {
  let app: INestApplication;
  let server: App;
  let prisma: PrismaService;
  let jwtService: JwtService;

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
    prisma = app.get<PrismaService>(PrismaService);
    jwtService = app.get<JwtService>(JwtService);
  });

  afterAll(async () => {
    // Cleanup any temporary registered test users
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [
            'test.signup@example.com',
            'test.privilege@example.com',
            'test.suspended@example.com',
          ],
        },
      },
    });

    await app.close();
  });

  describe('Customer Registration (POST /api/v1/auth/customer/register)', () => {
    it('should register a new customer successfully and return JWT and sanitized profile', async () => {
      const response = await request(server)
        .post('/api/v1/auth/customer/register')
        .send({
          email: 'test.signup@example.com',
          password: 'Password123!',
          name: 'Ananya Roy',
          phone: '+919876543999',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.email).toBe('test.signup@example.com');
      expect(response.body.data.user.firstName).toBe('Ananya');
      expect(response.body.data.user.lastName).toBe('Roy');
      expect(response.body.data.user.role).toBe('CUSTOMER');
      expect(response.body.data.user.status).toBe('ACTIVE');

      // Crucial Security Verification: No credentials leaked
      expect(response.body.data.user.passwordHash).toBeUndefined();
      expect(response.body.data.user.password).toBeUndefined();
    });

    it('should reject duplicate customer registration with 409 Conflict', async () => {
      const response = await request(server)
        .post('/api/v1/auth/customer/register')
        .send({
          email: 'test.signup@example.com',
          password: 'Password123!',
          firstName: 'Ananya',
          lastName: 'Roy',
        })
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('EMAIL_ALREADY_REGISTERED');
    });

    it('should reject registration with malformed email', async () => {
      const response = await request(server)
        .post('/api/v1/auth/customer/register')
        .send({
          email: 'not-an-email',
          password: 'Password123!',
          firstName: 'Bad',
          lastName: 'Email',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject registration with short password (< 8 chars)', async () => {
      const response = await request(server)
        .post('/api/v1/auth/customer/register')
        .send({
          email: 'shortpass@example.com',
          password: '123',
          firstName: 'Short',
          lastName: 'Pass',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('SECURITY TEST: should reject privilege-escalation attempt (submitting role: ADMIN)', async () => {
      // Non-whitelisted field "role" should be rejected by validation pipe
      const response = await request(server)
        .post('/api/v1/auth/customer/register')
        .send({
          email: 'test.privilege@example.com',
          password: 'Password123!',
          firstName: 'Attacker',
          lastName: 'User',
          role: 'ADMIN',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');

      // Verify the user was NOT created as ADMIN in database
      const dbUser = await prisma.user.findFirst({
        where: { email: 'test.privilege@example.com' },
      });
      expect(dbUser).toBeNull();
    });
  });

  describe('Customer Login Portal (POST /api/v1/auth/customer/login)', () => {
    it('should authenticate valid CUSTOMER account', async () => {
      const response = await request(server)
        .post('/api/v1/auth/customer/login')
        .send({
          email: 'customer@stayora.com',
          password: 'Password123!',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.role).toBe('CUSTOMER');
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.user.passwordHash).toBeUndefined();
    });

    it('should reject incorrect password with generic 401 INVALID_CREDENTIALS', async () => {
      const response = await request(server)
        .post('/api/v1/auth/customer/login')
        .send({
          email: 'customer@stayora.com',
          password: 'WrongPassword!',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(response.body.error.message).toBe('Invalid email or password.');
    });

    it('should reject unknown email with identical 401 INVALID_CREDENTIALS (no user enumeration)', async () => {
      const response = await request(server)
        .post('/api/v1/auth/customer/login')
        .send({
          email: 'unknown.user@stayora.com',
          password: 'Password123!',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(response.body.error.message).toBe('Invalid email or password.');
    });

    it('CROSS-PORTAL REJECTION: should reject MANAGER trying to login through customer portal', async () => {
      const response = await request(server)
        .post('/api/v1/auth/customer/login')
        .send({
          email: 'manager@stayora.com',
          password: 'Password123!',
        })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_APPLICATION_ROLE');
    });

    it('CROSS-PORTAL REJECTION: should reject ADMIN trying to login through customer portal', async () => {
      const response = await request(server)
        .post('/api/v1/auth/customer/login')
        .send({
          email: 'admin@stayora.com',
          password: 'Password123!',
        })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_APPLICATION_ROLE');
    });
  });

  describe('Manager Login Portal (POST /api/v1/auth/manager/login)', () => {
    it('should authenticate valid HOTEL_MANAGER account', async () => {
      const response = await request(server)
        .post('/api/v1/auth/manager/login')
        .send({
          email: 'manager@stayora.com',
          password: 'Password123!',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.role).toBe('HOTEL_MANAGER');
      expect(response.body.data.accessToken).toBeDefined();
    });

    it('CROSS-PORTAL REJECTION: should reject CUSTOMER trying to login through manager portal', async () => {
      const response = await request(server)
        .post('/api/v1/auth/manager/login')
        .send({
          email: 'customer@stayora.com',
          password: 'Password123!',
        })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_APPLICATION_ROLE');
    });

    it('CROSS-PORTAL REJECTION: should reject ADMIN trying to login through manager portal', async () => {
      const response = await request(server)
        .post('/api/v1/auth/manager/login')
        .send({
          email: 'admin@stayora.com',
          password: 'Password123!',
        })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_APPLICATION_ROLE');
    });
  });

  describe('Admin Login Portal (POST /api/v1/auth/admin/login)', () => {
    it('should authenticate valid ADMIN account', async () => {
      const response = await request(server)
        .post('/api/v1/auth/admin/login')
        .send({
          email: 'admin@stayora.com',
          password: 'Password123!',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.role).toBe('ADMIN');
      expect(response.body.data.accessToken).toBeDefined();
    });

    it('CROSS-PORTAL REJECTION: should reject CUSTOMER trying to login through admin portal', async () => {
      const response = await request(server)
        .post('/api/v1/auth/admin/login')
        .send({
          email: 'customer@stayora.com',
          password: 'Password123!',
        })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_APPLICATION_ROLE');
    });

    it('CROSS-PORTAL REJECTION: should reject MANAGER trying to login through admin portal', async () => {
      const response = await request(server)
        .post('/api/v1/auth/admin/login')
        .send({
          email: 'manager@stayora.com',
          password: 'Password123!',
        })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_APPLICATION_ROLE');
    });
  });

  describe('Protected Current User Endpoint (GET /api/v1/auth/me)', () => {
    let customerToken: string;

    beforeAll(async () => {
      const res = await request(server)
        .post('/api/v1/auth/customer/login')
        .send({
          email: 'customer@stayora.com',
          password: 'Password123!',
        });
      customerToken = res.body.data.accessToken;
    });

    it('should return current user profile with valid Bearer token', async () => {
      const response = await request(server)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe('customer@stayora.com');
      expect(response.body.data.role).toBe('CUSTOMER');
      expect(response.body.data.passwordHash).toBeUndefined();
    });

    it('should reject request when Authorization header is missing', async () => {
      const response = await request(server)
        .get('/api/v1/auth/me')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject malformed or tampered Bearer token', async () => {
      const response = await request(server)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid.tampered.token')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });

    it('should reject expired Bearer token with 401 TOKEN_EXPIRED', async () => {
      // Craft an expired JWT using jwtService with negative expiresIn
      const expiredToken = jwtService.sign(
        { sub: '00000000-0000-0000-0000-000000000000', email: 'exp@stayora.com', role: 'CUSTOMER' },
        { expiresIn: '-1s' },
      );

      const response = await request(server)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('TOKEN_EXPIRED');
    });

    it('AUTHORITATIVE STATE: should reject token if user is suspended in the database', async () => {
      // Create a temporary suspended user
      const suspendedUser = await prisma.user.create({
        data: {
          email: 'test.suspended@example.com',
          passwordHash: 'dummyhash',
          firstName: 'Suspended',
          lastName: 'User',
          role: 'CUSTOMER',
          status: 'SUSPENDED',
        },
      });

      // Sign a valid JWT for this suspended user
      const suspendedToken = jwtService.sign({
        sub: suspendedUser.id,
        email: suspendedUser.email,
        role: suspendedUser.role,
      });

      const response = await request(server)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${suspendedToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('ACCOUNT_SUSPENDED');
    });
  });

  describe('User Logout (POST /api/v1/auth/logout)', () => {
    it('should acknowledge logout successfully', async () => {
      const response = await request(server)
        .post('/api/v1/auth/logout')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe(
        'Successfully logged out. Client token discarded.',
      );
    });
  });
});
