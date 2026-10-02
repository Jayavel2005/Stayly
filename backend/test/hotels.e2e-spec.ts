import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { GlobalExceptionFilter, TransformInterceptor } from '../src/common';

describe('Hotel Management & Lifecycle (e2e)', () => {
  let app: INestApplication;
  let server: App;
  let prisma: PrismaService;

  let customerToken: string;
  let managerToken: string;
  let adminToken: string;
  let managerUserId: string;

  const testHotelSlug = 'test-hotel-taj-gateway';
  let createdHotelId: string;

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

    // Authenticate seeded users
    const customerLogin = await request(server)
      .post('/api/v1/auth/customer/login')
      .send({ email: 'customer@stayora.com', password: 'Password123!' });
    customerToken = customerLogin.body.data.accessToken;

    const managerLogin = await request(server)
      .post('/api/v1/auth/manager/login')
      .send({ email: 'manager@stayora.com', password: 'Password123!' });
    managerToken = managerLogin.body.data.accessToken;
    managerUserId = managerLogin.body.data.user.id;

    const adminLogin = await request(server)
      .post('/api/v1/auth/admin/login')
      .send({ email: 'admin@stayora.com', password: 'Password123!' });
    adminToken = adminLogin.body.data.accessToken;
  });

  afterAll(async () => {
    if (createdHotelId) {
      await prisma.hotelManager.deleteMany({ where: { hotelId: createdHotelId } });
      await prisma.hotel.deleteMany({ where: { id: createdHotelId } });
    }
    await app.close();
  });

  // ===========================================================================
  // 1. Hotel Creation (Admin Only)
  // ===========================================================================
  describe('Hotel Creation (POST /api/v1/admin/hotels)', () => {
    it('should allow ADMIN to create a new hotel property', async () => {
      const response = await request(server)
        .post('/api/v1/admin/hotels')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Taj Gateway Resort',
          slug: testHotelSlug,
          description: 'A luxurious waterfront heritage sanctuary in Cochin.',
          starRating: 5,
          addressLine1: 'Willingdon Island',
          city: 'Kochi',
          state: 'Kerala',
          country: 'India',
          postalCode: '682003',
          latitude: 9.9674,
          longitude: 76.2711,
          phone: '+914842666888',
          email: 'taj.gateway@stayora.com',
          checkInTime: '14:00',
          checkOutTime: '11:00',
          isActive: true,
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.name).toBe('Taj Gateway Resort');
      expect(response.body.data.slug).toBe(testHotelSlug);
      expect(response.body.data.city).toBe('Kochi');

      createdHotelId = response.body.data.id;
    });

    it('should reject duplicate slug creation with 409 CONFLICT', async () => {
      const response = await request(server)
        .post('/api/v1/admin/hotels')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Taj Gateway Clone',
          slug: testHotelSlug, // Identical slug
          description: 'Duplicate hotel test description.',
          addressLine1: 'Willingdon Island',
          city: 'Kochi',
          state: 'Kerala',
          country: 'India',
          postalCode: '682003',
          phone: '+914842666888',
          email: 'taj.clone@stayora.com',
        })
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('CONFLICT');
    });

    it('should REJECT customer attempting to create a hotel with 403 FORBIDDEN', async () => {
      const response = await request(server)
        .post('/api/v1/admin/hotels')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          name: 'Customer Created Hotel',
          description: 'Unauthorized creation attempt.',
          addressLine1: 'Street 1',
          city: 'Delhi',
          state: 'Delhi',
          country: 'India',
          postalCode: '110001',
          phone: '+911123456789',
          email: 'hack@hotel.com',
        })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('should REJECT manager attempting to create a hotel with 403 FORBIDDEN', async () => {
      const response = await request(server)
        .post('/api/v1/admin/hotels')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          name: 'Manager Created Hotel',
          description: 'Unauthorized creation attempt.',
          addressLine1: 'Street 1',
          city: 'Delhi',
          state: 'Delhi',
          country: 'India',
          postalCode: '110001',
          phone: '+911123456789',
          email: 'hack@hotel.com',
        })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('should REJECT unauthenticated creation with 401 UNAUTHORIZED', async () => {
      await request(server)
        .post('/api/v1/admin/hotels')
        .send({
          name: 'Anonymous Hotel',
          description: 'No token attempt.',
          addressLine1: 'Street 1',
          city: 'Delhi',
          state: 'Delhi',
          country: 'India',
          postalCode: '110001',
          phone: '+911123456789',
          email: 'anon@hotel.com',
        })
        .expect(401);
    });

    it('should REJECT invalid star rating (> 5) with 400 VALIDATION_ERROR', async () => {
      const response = await request(server)
        .post('/api/v1/admin/hotels')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: '7 Star Invalid Hotel',
          description: 'Invalid star rating test.',
          starRating: 7, // Invalid
          addressLine1: 'Street 1',
          city: 'Delhi',
          state: 'Delhi',
          country: 'India',
          postalCode: '110001',
          phone: '+911123456789',
          email: 'invalid@hotel.com',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ===========================================================================
  // 2. Public Discovery (Customer & Public Browsing)
  // ===========================================================================
  describe('Public Hotel Discovery (GET /api/v1/hotels)', () => {
    it('should allow unauthenticated clients to browse active hotels with pagination', async () => {
      const response = await request(server)
        .get('/api/v1/hotels?page=1&limit=5')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toBeDefined();
      expect(Array.isArray(response.body.data.items)).toBe(true);
      expect(response.body.data.meta).toEqual(
        expect.objectContaining({
          page: 1,
          limit: 5,
          total: expect.any(Number),
          totalPages: expect.any(Number),
        }),
      );
    });

    it('should filter hotels by city accurately', async () => {
      const response = await request(server)
        .get('/api/v1/hotels?city=Kochi')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items.length).toBeGreaterThanOrEqual(1);
      for (const item of response.body.data.items) {
        expect(item.city.toLowerCase()).toContain('kochi');
      }
    });

    it('should support case-insensitive name search', async () => {
      const response = await request(server)
        .get('/api/v1/hotels?search=gateway')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items.length).toBeGreaterThanOrEqual(1);
      expect(response.body.data.items[0].name).toContain('Gateway');
    });

    it('should retrieve a single active hotel by ID through public endpoint', async () => {
      const response = await request(server)
        .get(`/api/v1/hotels/${createdHotelId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(createdHotelId);
      expect(response.body.data.name).toBe('Taj Gateway Resort');
    });

    it('should return 404 NOT_FOUND for non-existent hotel ID', async () => {
      const nonExistentId = '00000000-0000-4000-8000-000000000000';
      const response = await request(server)
        .get(`/api/v1/hotels/${nonExistentId}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  // ===========================================================================
  // 3. Manager Assignment & Dynamic Authorization
  // ===========================================================================
  describe('Manager Assignment & Operational Access', () => {
    it('Manager should initially be DENIED access to unassigned newly created hotel', async () => {
      // Manager is not yet assigned to Taj Gateway Resort
      const response = await request(server)
        .get(`/api/v1/manager/hotels/${createdHotelId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('ADMIN should assign the manager to the new hotel property', async () => {
      const response = await request(server)
        .post(`/api/v1/admin/hotels/${createdHotelId}/managers`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          managerId: managerUserId,
          isPrimary: true,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.hotelId).toBe(createdHotelId);
      expect(response.body.data.userId).toBe(managerUserId);
    });

    it('Manager should NOW be ALLOWED to access and update the newly assigned hotel', async () => {
      // 1. GET managed hotel
      const getRes = await request(server)
        .get(`/api/v1/manager/hotels/${createdHotelId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      expect(getRes.body.success).toBe(true);
      expect(getRes.body.data.id).toBe(createdHotelId);

      // 2. PATCH managed hotel
      const patchRes = await request(server)
        .patch(`/api/v1/manager/hotels/${createdHotelId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ phone: '+914842999000' })
        .expect(200);

      expect(patchRes.body.success).toBe(true);
      expect(patchRes.body.data.phone).toBe('+914842999000');
    });

    it('ADMIN should unassign manager from the hotel', async () => {
      const response = await request(server)
        .delete(`/api/v1/admin/hotels/${createdHotelId}/managers/${managerUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain('successfully revoked');
    });

    it('Manager should once again be DENIED access to unassigned hotel', async () => {
      const response = await request(server)
        .get(`/api/v1/manager/hotels/${createdHotelId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });
  });

  // ===========================================================================
  // 4. Soft Deletion & Public Invisibility Lifecycle
  // ===========================================================================
  describe('Deactivation & Lifecycle Integrity', () => {
    it('Admin can view full hotel record through admin overview', async () => {
      const response = await request(server)
        .get(`/api/v1/admin/hotels/${createdHotelId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(createdHotelId);
    });

    it('Admin should be able to update hotel to inactive', async () => {
      // Re-assign manager temporarily to test deactivation
      await prisma.hotelManager.create({
        data: { userId: managerUserId, hotelId: createdHotelId },
      });

      // Manager deactivates hotel
      const delRes = await request(server)
        .delete(`/api/v1/manager/hotels/${createdHotelId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      expect(delRes.body.success).toBe(true);

      // Verify hotel is now inactive and has deletedAt timestamp
      const dbHotel = await prisma.hotel.findUnique({
        where: { id: createdHotelId },
      });
      expect(dbHotel?.isActive).toBe(false);
      expect(dbHotel?.deletedAt).not.toBeNull();
    });

    it('Deactivated hotel must NOT appear in public discovery listing', async () => {
      const response = await request(server)
        .get(`/api/v1/hotels?city=Kochi`)
        .expect(200);

      expect(response.body.success).toBe(true);
      const ids = response.body.data.items.map((h: any) => h.id);
      expect(ids).not.toContain(createdHotelId);
    });

    it('Public GET /api/v1/hotels/:id for deactivated hotel returns 404 NOT_FOUND', async () => {
      const response = await request(server)
        .get(`/api/v1/hotels/${createdHotelId}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });
});
