import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { GlobalExceptionFilter, TransformInterceptor } from '../src/common';
import * as bcrypt from 'bcrypt';

describe('RBAC & Resource-Level Authorization (e2e)', () => {
  let app: INestApplication;
  let server: App;
  let prisma: PrismaService;

  let customerToken: string;
  let managerAToken: string;
  let managerBToken: string;
  let adminToken: string;

  let hotelAId: string;
  let hotelBId: string;
  let hotelCId: string; // Unassigned to Manager A, assigned to Manager B

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

    // 1. Obtain Tokens for Seeded Users
    const customerLogin = await request(server)
      .post('/api/v1/auth/customer/login')
      .send({ email: 'customer@stayora.com', password: 'Password123!' });
    customerToken = customerLogin.body.data.accessToken;

    const managerALogin = await request(server)
      .post('/api/v1/auth/manager/login')
      .send({ email: 'manager@stayora.com', password: 'Password123!' });
    managerAToken = managerALogin.body.data.accessToken;

    const adminLogin = await request(server)
      .post('/api/v1/auth/admin/login')
      .send({ email: 'admin@stayora.com', password: 'Password123!' });
    adminToken = adminLogin.body.data.accessToken;

    // 2. Fetch Assigned Hotels for Manager A (Mumbai and Goa)
    const hotelMumbai = await prisma.hotel.findFirst({
      where: { slug: 'stayora-grand-palace' },
    });
    const hotelGoa = await prisma.hotel.findFirst({
      where: { slug: 'stayora-bayfront-resort' },
    });
    hotelAId = hotelMumbai!.id;
    hotelBId = hotelGoa!.id;

    // 3. Create Manager B and Hotel C (Separate Tenant for IDOR testing)
    const passwordHash = await bcrypt.hash('Password123!', 10);
    const managerBUser = await prisma.user.upsert({
      where: { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' },
      update: {},
      create: {
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        email: 'manager.b@stayora.com',
        passwordHash,
        firstName: 'Manager',
        lastName: 'Bravo',
        role: 'HOTEL_MANAGER',
        status: 'ACTIVE',
      },
    });

    const hotelC = await prisma.hotel.upsert({
      where: { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' },
      update: {},
      create: {
        id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        name: 'Stayora Himalayan Retreat',
        slug: 'stayora-himalayan-retreat',
        description: 'Exclusive mountain sanctuary in Manali.',
        starRating: 5,
        addressLine1: 'Solang Valley',
        city: 'Manali',
        state: 'Himachal Pradesh',
        country: 'India',
        postalCode: '175131',
        phone: '+911902256789',
        email: 'manali@stayora.com',
        isActive: true,
      },
    });
    hotelCId = hotelC.id;

    // Assign Manager B to Hotel C
    await prisma.hotelManager.upsert({
      where: {
        userId_hotelId: {
          userId: managerBUser.id,
          hotelId: hotelC.id,
        },
      },
      update: {},
      create: {
        userId: managerBUser.id,
        hotelId: hotelC.id,
        isPrimary: true,
      },
    });

    const managerBLogin = await request(server)
      .post('/api/v1/auth/manager/login')
      .send({ email: 'manager.b@stayora.com', password: 'Password123!' });
    managerBToken = managerBLogin.body.data.accessToken;
  });

  afterAll(async () => {
    // Cleanup temporary test tenant
    await prisma.hotelManager.deleteMany({
      where: { hotelId: hotelCId },
    });
    await prisma.hotel.deleteMany({
      where: { id: hotelCId },
    });
    await prisma.user.deleteMany({
      where: { email: 'manager.b@stayora.com' },
    });

    await app.close();
  });

  // ===========================================================================
  // 1. RBAC Authentication & Role Checks (401 vs 403)
  // ===========================================================================
  describe('RBAC Role Guard Invariants (401 vs 403)', () => {
    it('should return 401 UNAUTHORIZED when no token is supplied', async () => {
      const response = await request(server)
        .get('/api/v1/manager/hotels')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 401 INVALID_TOKEN when token is malformed', async () => {
      const response = await request(server)
        .get('/api/v1/manager/hotels')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });

    it('should return 403 FORBIDDEN when user is authenticated but role is insufficient', async () => {
      // Customer has valid JWT, but role is CUSTOMER, endpoint requires HOTEL_MANAGER
      const response = await request(server)
        .get('/api/v1/manager/hotels')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
      expect(response.body.error.message).toBe(
        'You do not have permission to access this resource.',
      );
    });
  });

  // ===========================================================================
  // 2. Vertical Privilege Escalation Defense
  // ===========================================================================
  describe('Vertical Privilege Escalation Defense', () => {
    it('CUSTOMER should be REJECTED from manager hotel endpoints', async () => {
      const response = await request(server)
        .get(`/api/v1/manager/hotels/${hotelAId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('CUSTOMER should be REJECTED from admin endpoints', async () => {
      const response = await request(server)
        .get('/api/v1/admin/hotels')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('MANAGER should be REJECTED from admin endpoints', async () => {
      const response = await request(server)
        .get('/api/v1/admin/hotels')
        .set('Authorization', `Bearer ${managerAToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('ADMIN should be ALLOWED on admin endpoints', async () => {
      const response = await request(server)
        .get('/api/v1/admin/hotels')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  // ===========================================================================
  // 3. Horizontal Privilege Escalation & IDOR Security Defense
  // ===========================================================================
  describe('Horizontal Privilege Escalation & IDOR Security Defense (ManagerHotel)', () => {
    it('Manager A should be ALLOWED to view assigned Hotel A', async () => {
      const response = await request(server)
        .get(`/api/v1/manager/hotels/${hotelAId}`)
        .set('Authorization', `Bearer ${managerAToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(hotelAId);
      expect(response.body.data.name).toBe('Stayora Grand Palace');
    });

    it('Manager A should be ALLOWED to view assigned Hotel B', async () => {
      const response = await request(server)
        .get(`/api/v1/manager/hotels/${hotelBId}`)
        .set('Authorization', `Bearer ${managerAToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(hotelBId);
    });

    it('Manager A should be ALLOWED to update assigned Hotel A', async () => {
      const response = await request(server)
        .patch(`/api/v1/manager/hotels/${hotelAId}`)
        .set('Authorization', `Bearer ${managerAToken}`)
        .send({ phone: '+912266659999' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.phone).toBe('+912266659999');
    });

    it('MANDATORY IDOR DEFENSE: Manager A must be REJECTED from viewing Hotel C (assigned to Manager B)', async () => {
      // Manager A attempts to manipulate URL to access Hotel C
      const response = await request(server)
        .get(`/api/v1/manager/hotels/${hotelCId}`)
        .set('Authorization', `Bearer ${managerAToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
      expect(response.body.error.message).toContain(
        'not assigned to manage this hotel property',
      );
    });

    it('MANDATORY IDOR DEFENSE: Manager A must be REJECTED from updating Hotel C', async () => {
      const response = await request(server)
        .patch(`/api/v1/manager/hotels/${hotelCId}`)
        .set('Authorization', `Bearer ${managerAToken}`)
        .send({ name: 'Hacked Hotel Name' })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');

      // Verify in database that Hotel C was NOT modified
      const hotel = await prisma.hotel.findUnique({ where: { id: hotelCId } });
      expect(hotel?.name).toBe('Stayora Himalayan Retreat');
    });

    it('MANDATORY IDOR DEFENSE: Manager A must be REJECTED from deleting Hotel C', async () => {
      const response = await request(server)
        .delete(`/api/v1/manager/hotels/${hotelCId}`)
        .set('Authorization', `Bearer ${managerAToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('Manager B should be ALLOWED to access Hotel C', async () => {
      const response = await request(server)
        .get(`/api/v1/manager/hotels/${hotelCId}`)
        .set('Authorization', `Bearer ${managerBToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(hotelCId);
      expect(response.body.data.name).toBe('Stayora Himalayan Retreat');
    });

    it('Manager B must be REJECTED from accessing Hotel A (assigned to Manager A)', async () => {
      const response = await request(server)
        .get(`/api/v1/manager/hotels/${hotelAId}`)
        .set('Authorization', `Bearer ${managerBToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('Non-existent hotel ID should return 404 NOT_FOUND', async () => {
      const nonExistentUuid = '99999999-9999-4999-8999-999999999999';
      const response = await request(server)
        .get(`/api/v1/manager/hotels/${nonExistentUuid}`)
        .set('Authorization', `Bearer ${managerAToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  // ===========================================================================
  // 4. Query Scoping by Assignment
  // ===========================================================================
  describe('Query Scoping by Manager Assignment', () => {
    it('GET /api/v1/manager/hotels should return ONLY hotels assigned to the calling manager', async () => {
      // Manager A should see exactly 2 hotels (Mumbai and Goa), and NOT Hotel C
      const responseA = await request(server)
        .get('/api/v1/manager/hotels')
        .set('Authorization', `Bearer ${managerAToken}`)
        .expect(200);

      expect(responseA.body.success).toBe(true);
      const hotelIdsA = responseA.body.data.map((h: any) => h.id);
      expect(hotelIdsA).toContain(hotelAId);
      expect(hotelIdsA).toContain(hotelBId);
      expect(hotelIdsA).not.toContain(hotelCId);

      // Manager B should see ONLY Hotel C
      const responseB = await request(server)
        .get('/api/v1/manager/hotels')
        .set('Authorization', `Bearer ${managerBToken}`)
        .expect(200);

      expect(responseB.body.success).toBe(true);
      const hotelIdsB = responseB.body.data.map((h: any) => h.id);
      expect(hotelIdsB).toEqual([hotelCId]);
    });
  });
});
