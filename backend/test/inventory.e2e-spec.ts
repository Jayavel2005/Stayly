import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { GlobalExceptionFilter, TransformInterceptor } from '../src/common';
import { RoomOperationalStatus } from '../src/modules/rooms/types/room-operational-status.enum';

describe('Room Types & Physical Room Inventory (e2e)', () => {
  let app: INestApplication;
  let server: App;
  let prisma: PrismaService;

  let customerToken: string;
  let managerAToken: string;
  let managerBToken: string;
  let adminToken: string;

  let hotelAId: string; // Mumbai hotel (assigned to Manager A)
  const hotelCId = '88888888-8888-4888-8888-888888888888'; // Manali hotel (assigned to Manager B)
  const managerBUserId = '77777777-7777-4777-8777-777777777777';

  let roomTypeAId: string;
  let roomTypeCId: string;
  let roomA101Id: string;
  let roomA102Id: string;
  let roomC101Id: string;

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

    // 2. Fetch Hotel A (Mumbai)
    const hotelA = await prisma.hotel.findFirst({
      where: { slug: 'stayora-grand-palace' },
    });
    hotelAId = hotelA!.id;

    // 3. Upsert Manager B and Hotel C (for IDOR and isolation tests)
    const passwordHash = await bcrypt.hash('Password123!', 10);
    await prisma.user.upsert({
      where: { id: managerBUserId },
      update: {},
      create: {
        id: managerBUserId,
        email: 'manager.bravo@stayora.com',
        passwordHash,
        firstName: 'Bravo',
        lastName: 'Manager',
        role: 'HOTEL_MANAGER',
        status: 'ACTIVE',
      },
    });

    await prisma.hotel.upsert({
      where: { id: hotelCId },
      update: {},
      create: {
        id: hotelCId,
        name: 'Stayora Himalayan Retreat Inventory',
        slug: 'stayora-himalayan-retreat-inventory',
        description: 'Alpine retreat in Manali.',
        starRating: 4,
        addressLine1: 'Solang Valley',
        city: 'Manali',
        state: 'Himachal Pradesh',
        country: 'India',
        postalCode: '175103',
        phone: '+911902255000',
        email: 'himalayan.inv@stayora.com',
        isActive: true,
      },
    });

    await prisma.hotelManager.upsert({
      where: {
        userId_hotelId: {
          userId: managerBUserId,
          hotelId: hotelCId,
        },
      },
      update: {},
      create: {
        userId: managerBUserId,
        hotelId: hotelCId,
        isPrimary: true,
      },
    });

    const managerBLogin = await request(server)
      .post('/api/v1/auth/manager/login')
      .send({ email: 'manager.bravo@stayora.com', password: 'Password123!' });
    managerBToken = managerBLogin.body.data.accessToken;
  });

  afterAll(async () => {
    // Cleanup created rooms and room types in correct referential order
    if (hotelCId) {
      await prisma.room.deleteMany({ where: { hotelId: hotelCId } });
      await prisma.roomType.deleteMany({ where: { hotelId: hotelCId } });
      await prisma.hotelManager.deleteMany({ where: { hotelId: hotelCId } });
      await prisma.hotel.deleteMany({ where: { id: hotelCId } });
    }

    if (roomTypeAId) {
      await prisma.room.deleteMany({ where: { roomTypeId: roomTypeAId } });
      await prisma.roomType.deleteMany({ where: { id: roomTypeAId } });
    }

    await prisma.user.deleteMany({ where: { id: managerBUserId } });
    await app.close();
  });

  // ===========================================================================
  // 1. RoomType Creation & RBAC / Authorization
  // ===========================================================================
  describe('RoomType Creation (POST /api/v1/room-types)', () => {
    it('should reject unauthenticated request with 401 Unauthorized', async () => {
      await request(server)
        .post('/api/v1/room-types')
        .send({
          hotelId: hotelAId,
          name: 'Executive Deluxe',
          description: 'High floor city view.',
          basePriceCents: 600000,
        })
        .expect(401);
    });

    it('should reject Customer with 403 Forbidden', async () => {
      await request(server)
        .post('/api/v1/room-types')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          hotelId: hotelAId,
          name: 'Executive Deluxe',
          description: 'High floor city view.',
          basePriceCents: 600000,
        })
        .expect(403);
    });

    it('should reject Manager A attempting to create RoomType in unassigned Hotel C (403 Forbidden)', async () => {
      await request(server)
        .post('/api/v1/room-types')
        .set('Authorization', `Bearer ${managerAToken}`)
        .send({
          hotelId: hotelCId, // Unassigned!
          name: 'Alpine Chalet',
          description: 'Chalet room.',
          basePriceCents: 750000,
        })
        .expect(403);
    });

    it('should allow Manager A to create RoomType in assigned Hotel A', async () => {
      const res = await request(server)
        .post('/api/v1/room-types')
        .set('Authorization', `Bearer ${managerAToken}`)
        .send({
          hotelId: hotelAId,
          name: 'Executive Heritage Suite',
          slug: 'executive-heritage-suite',
          description: 'Spacious colonial suite with ocean view.',
          maxOccupancy: 3,
          maxAdults: 2,
          maxChildren: 1,
          basePriceCents: 850000,
          bedType: 'KING',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Executive Heritage Suite');
      expect(res.body.data.hotel.id).toBe(hotelAId);
      roomTypeAId = res.body.data.id;
    });

    it('should allow Manager B to create RoomType in assigned Hotel C', async () => {
      const res = await request(server)
        .post('/api/v1/room-types')
        .set('Authorization', `Bearer ${managerBToken}`)
        .send({
          hotelId: hotelCId,
          name: 'Snow View Chalet',
          slug: 'snow-view-chalet',
          description: 'Wooden chalet with snow-capped mountain views.',
          maxOccupancy: 2,
          maxAdults: 2,
          maxChildren: 0,
          basePriceCents: 950000,
          bedType: 'KING',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      roomTypeCId = res.body.data.id;
    });

    it('should reject duplicate RoomType slug within the SAME hotel with 409 Conflict', async () => {
      await request(server)
        .post('/api/v1/room-types')
        .set('Authorization', `Bearer ${managerAToken}`)
        .send({
          hotelId: hotelAId,
          name: 'Executive Heritage Suite',
          slug: 'executive-heritage-suite', // duplicate in hotel A!
          description: 'Duplicate attempt.',
          basePriceCents: 850000,
        })
        .expect(409);
    });
  });

  // ===========================================================================
  // 2. RoomType Discovery & Filtering
  // ===========================================================================
  describe('RoomType Retrieval (GET /api/v1/room-types)', () => {
    it('should allow public unauthenticated listing of active room types with pagination', async () => {
      const res = await request(server)
        .get('/api/v1/room-types?page=1&limit=10')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(res.body.data.meta).toBeDefined();
      expect(res.body.data.meta.page).toBe(1);
    });

    it('should filter room types by hotelId', async () => {
      const res = await request(server)
        .get(`/api/v1/room-types?hotelId=${hotelAId}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      for (const item of res.body.data.items) {
        expect(item.hotel.id).toBe(hotelAId);
      }
    });

    it('should get room type by ID publicly', async () => {
      const res = await request(server)
        .get(`/api/v1/room-types/${roomTypeAId}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(roomTypeAId);
      expect(res.body.data.name).toBe('Executive Heritage Suite');
    });

    it('should return 404 for non-existent room type ID', async () => {
      await request(server)
        .get('/api/v1/room-types/00000000-0000-4000-8000-000000000000')
        .expect(404);
    });
  });

  // ===========================================================================
  // 3. RoomType Updates & Privilege Separation
  // ===========================================================================
  describe('RoomType Update (PATCH /api/v1/room-types/:id)', () => {
    it('should reject Manager A updating RoomType in Hotel C (403 Forbidden - IDOR Defense)', async () => {
      await request(server)
        .patch(`/api/v1/room-types/${roomTypeCId}`)
        .set('Authorization', `Bearer ${managerAToken}`)
        .send({
          name: 'Hacked Chalet',
        })
        .expect(403);
    });

    it('should allow Manager A to update RoomType in assigned Hotel A', async () => {
      const res = await request(server)
        .patch(`/api/v1/room-types/${roomTypeAId}`)
        .set('Authorization', `Bearer ${managerAToken}`)
        .send({
          description: 'Updated luxury description with balcony.',
          basePriceCents: 900000,
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.description).toBe('Updated luxury description with balcony.');
    });
  });

  // ===========================================================================
  // 4. Physical Room Creation & Invariants
  // ===========================================================================
  describe('Room Creation (POST /api/v1/rooms)', () => {
    it('should reject Customer creating room with 403 Forbidden', async () => {
      await request(server)
        .post('/api/v1/rooms')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          roomTypeId: roomTypeAId,
          roomNumber: '901',
        })
        .expect(403);
    });

    it('should reject Manager A attempting to create room under Hotel C RoomType (403 Forbidden)', async () => {
      await request(server)
        .post('/api/v1/rooms')
        .set('Authorization', `Bearer ${managerAToken}`)
        .send({
          roomTypeId: roomTypeCId, // belongs to Hotel C!
          roomNumber: '901',
        })
        .expect(403);
    });

    it('should reject when client passes mismatched hotelId', async () => {
      await request(server)
        .post('/api/v1/rooms')
        .set('Authorization', `Bearer ${managerAToken}`)
        .send({
          roomTypeId: roomTypeAId,
          hotelId: hotelCId, // Mismatch with roomTypeAId parent hotel!
          roomNumber: '901',
        })
        .expect(400);
    });

    it('should allow Manager A to create physical room 901 in Hotel A', async () => {
      const res = await request(server)
        .post('/api/v1/rooms')
        .set('Authorization', `Bearer ${managerAToken}`)
        .send({
          roomTypeId: roomTypeAId,
          roomNumber: '901',
          floor: 1,
          operationalStatus: RoomOperationalStatus.AVAILABLE,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.roomNumber).toBe('901');
      expect(res.body.data.hotel.id).toBe(hotelAId);
      roomA101Id = res.body.data.id;
    });

    it('should allow Manager A to create second physical room 902 in Hotel A', async () => {
      const res = await request(server)
        .post('/api/v1/rooms')
        .set('Authorization', `Bearer ${managerAToken}`)
        .send({
          roomTypeId: roomTypeAId,
          roomNumber: '902',
          floor: 1,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      roomA102Id = res.body.data.id;
    });

    it('should reject duplicate room number in the SAME hotel with 409 Conflict', async () => {
      await request(server)
        .post('/api/v1/rooms')
        .set('Authorization', `Bearer ${managerAToken}`)
        .send({
          roomTypeId: roomTypeAId,
          roomNumber: '901', // Already exists in Hotel A!
        })
        .expect(409);
    });

    it('should ALLOW the SAME room number in a DIFFERENT hotel (Hotel C Room 901)', async () => {
      const res = await request(server)
        .post('/api/v1/rooms')
        .set('Authorization', `Bearer ${managerBToken}`)
        .send({
          roomTypeId: roomTypeCId,
          roomNumber: '901', // Same number '901', but in Hotel C!
          floor: 1,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.roomNumber).toBe('901');
      expect(res.body.data.hotel.id).toBe(hotelCId);
      roomC101Id = res.body.data.id;
    });
  });

  // ===========================================================================
  // 5. Physical Room Retrieval & Query Scoping
  // ===========================================================================
  describe('Room Retrieval & Inventory Listing (GET /api/v1/rooms)', () => {
    it('should reject Customer with 403 Forbidden (Inventory units are operational)', async () => {
      await request(server)
        .get('/api/v1/rooms')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);
    });

    it('should scope Manager A room listing to only assigned properties', async () => {
      const res = await request(server)
        .get('/api/v1/rooms')
        .set('Authorization', `Bearer ${managerAToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      // Ensure Hotel C rooms are NOT visible to Manager A
      for (const room of res.body.data.items) {
        expect(room.hotel.id).not.toBe(hotelCId);
      }
    });

    it('should reject Manager A requesting Hotel C rooms with 403 Forbidden', async () => {
      await request(server)
        .get(`/api/v1/rooms?hotelId=${hotelCId}`)
        .set('Authorization', `Bearer ${managerAToken}`)
        .expect(403);
    });

    it('should get room by ID for authorized Manager A', async () => {
      const res = await request(server)
        .get(`/api/v1/rooms/${roomA101Id}`)
        .set('Authorization', `Bearer ${managerAToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(roomA101Id);
      expect(res.body.data.roomNumber).toBe('901');
    });

    it('should reject Manager A fetching Hotel C room by ID with 403 Forbidden', async () => {
      await request(server)
        .get(`/api/v1/rooms/${roomC101Id}`)
        .set('Authorization', `Bearer ${managerAToken}`)
        .expect(403);
    });
  });

  // ===========================================================================
  // 6. Operational Status Transitions
  // ===========================================================================
  describe('Operational Status (PATCH /api/v1/rooms/:id/status)', () => {
    it('should update room operational status to MAINTENANCE', async () => {
      const res = await request(server)
        .patch(`/api/v1/rooms/${roomA101Id}/status`)
        .set('Authorization', `Bearer ${managerAToken}`)
        .send({ status: RoomOperationalStatus.MAINTENANCE })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.operationalStatus).toBe(RoomOperationalStatus.MAINTENANCE);
    });

    it('should reject invalid operational status enum with 400 Bad Request', async () => {
      await request(server)
        .patch(`/api/v1/rooms/${roomA101Id}/status`)
        .set('Authorization', `Bearer ${managerAToken}`)
        .send({ status: 'INVALID_STATUS' })
        .expect(400);
    });

    it('should reject Manager A modifying status of Hotel C room (403 Forbidden)', async () => {
      await request(server)
        .patch(`/api/v1/rooms/${roomC101Id}/status`)
        .set('Authorization', `Bearer ${managerAToken}`)
        .send({ status: RoomOperationalStatus.MAINTENANCE })
        .expect(403);
    });
  });

  // ===========================================================================
  // 7. Room Updates & Cross-Hotel Reassignment Prevention
  // ===========================================================================
  describe('Room Updates (PATCH /api/v1/rooms/:id)', () => {
    it('should reject moving Room A101 to RoomType C (in another hotel) with 400 Bad Request', async () => {
      await request(server)
        .patch(`/api/v1/rooms/${roomA101Id}`)
        .set('Authorization', `Bearer ${adminToken}`) // even admin cannot cross-link across hotels!
        .send({ roomTypeId: roomTypeCId })
        .expect(400);
    });

    it('should allow updating room number and floor', async () => {
      const res = await request(server)
        .patch(`/api/v1/rooms/${roomA101Id}`)
        .set('Authorization', `Bearer ${managerAToken}`)
        .send({ roomNumber: '901A', floor: 2 })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.roomNumber).toBe('901A');
      expect(res.body.data.floor).toBe(2);
    });
  });

  // ===========================================================================
  // 8. Referential Integrity & Deletion Rules
  // ===========================================================================
  describe('Referential Integrity & Deletion Rules', () => {
    it('should reject deleting RoomType A while it contains active rooms (409 Conflict)', async () => {
      await request(server)
        .delete(`/api/v1/room-types/${roomTypeAId}`)
        .set('Authorization', `Bearer ${managerAToken}`)
        .expect(409);
    });

    it('should soft-delete physical room 902', async () => {
      const res = await request(server)
        .delete(`/api/v1/rooms/${roomA102Id}`)
        .set('Authorization', `Bearer ${managerAToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('should soft-delete physical room 901A', async () => {
      const res = await request(server)
        .delete(`/api/v1/rooms/${roomA101Id}`)
        .set('Authorization', `Bearer ${managerAToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('should now allow soft-deleting RoomType A after all rooms are deleted', async () => {
      const res = await request(server)
        .delete(`/api/v1/room-types/${roomTypeAId}`)
        .set('Authorization', `Bearer ${managerAToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
    });
  });
});
