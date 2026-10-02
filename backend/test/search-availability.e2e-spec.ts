import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { GlobalExceptionFilter, TransformInterceptor } from '../src/common';

describe('Hotel Search & Availability (e2e)', () => {
  let app: INestApplication;
  let server: App;
  let prisma: PrismaService;

  const HOTEL_MUMBAI_ID = '44444444-4444-4444-8444-444444444444';
  const HOTEL_GOA_ID = '55555555-5555-4555-8555-555555555555';
  let mumbaiStandardRoomTypeId: string;
  let room103Id: string;

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

    // Retrieve Mumbai Standard roomType ID and Room 103 ID
    const roomType = await prisma.roomType.findFirst({
      where: {
        hotelId: HOTEL_MUMBAI_ID,
        slug: 'classic-heritage-room',
      },
    });
    expect(roomType).toBeDefined();
    mumbaiStandardRoomTypeId = roomType!.id;

    const room103 = await prisma.room.findFirst({
      where: {
        hotelId: HOTEL_MUMBAI_ID,
        roomNumber: '103',
      },
    });
    expect(room103).toBeDefined();
    room103Id = room103!.id;
  });

  afterAll(async () => {
    // Ensure room 103 is reset to AVAILABLE if modified during tests
    if (room103Id) {
      await prisma.room.update({
        where: { id: room103Id },
        data: { operationalStatus: 'AVAILABLE' },
      });
    }
    await app.close();
  });

  // ===========================================================================
  // 1. Date Validation & Parameter Integrity
  // ===========================================================================
  describe('Date Validation & Query Parameters', () => {
    it('should reject search without checkIn (400 Bad Request)', async () => {
      const res = await request(server)
        .get('/api/v1/search/hotels')
        .query({ checkOut: '2026-10-25' })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(JSON.stringify(res.body.error)).toContain('checkIn must be a valid calendar date');
    });

    it('should reject search without checkOut (400 Bad Request)', async () => {
      const res = await request(server)
        .get('/api/v1/search/hotels')
        .query({ checkIn: '2026-10-20' })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(JSON.stringify(res.body.error)).toContain('checkOut must be a valid calendar date');
    });

    it('should reject malformed date strings (400 Bad Request)', async () => {
      const res = await request(server)
        .get('/api/v1/search/hotels')
        .query({ checkIn: 'not-a-date', checkOut: '2026-10-25' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('should reject checkOut <= checkIn (400 Bad Request)', async () => {
      // checkOut == checkIn
      const resEqual = await request(server)
        .get('/api/v1/search/hotels')
        .query({ checkIn: '2026-10-20', checkOut: '2026-10-20' })
        .expect(400);
      expect(resEqual.body.success).toBe(false);
      expect(resEqual.body.error.message).toContain('checkOut date must be strictly after checkIn date');

      // checkOut < checkIn
      const resBefore = await request(server)
        .get('/api/v1/search/hotels')
        .query({ checkIn: '2026-10-25', checkOut: '2026-10-20' })
        .expect(400);
      expect(resBefore.body.success).toBe(false);
      expect(resBefore.body.error.message).toContain('checkOut date must be strictly after checkIn date');
    });

    it('should reject past checkIn dates (400 Bad Request)', async () => {
      const res = await request(server)
        .get('/api/v1/search/hotels')
        .query({ checkIn: '2020-01-01', checkOut: '2020-01-05' })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('checkIn date cannot be in the past');
    });

    it('should reject invalid guest count < 1 (400 Bad Request)', async () => {
      const res = await request(server)
        .get('/api/v1/search/hotels')
        .query({ checkIn: '2026-10-20', checkOut: '2026-10-22', guests: 0 })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(JSON.stringify(res.body.error)).toContain('guests must not be less than 1');
    });

    it('should reject invalid room count < 1 (400 Bad Request)', async () => {
      const res = await request(server)
        .get('/api/v1/search/hotels')
        .query({ checkIn: '2026-10-20', checkOut: '2026-10-22', rooms: 0 })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(JSON.stringify(res.body.error)).toContain('rooms must not be less than 1');
    });
  });

  // ===========================================================================
  // 2. Public Access & Basic Discovery
  // ===========================================================================
  describe('Public Hotel Search', () => {
    it('should allow unauthenticated access to hotel search (200 OK)', async () => {
      const res = await request(server)
        .get('/api/v1/search/hotels')
        .query({ checkIn: '2026-10-20', checkOut: '2026-10-22' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(res.body.data.meta).toBeDefined();
      expect(res.body.data.meta.page).toBe(1);
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter hotels by city case-insensitively', async () => {
      const res = await request(server)
        .get('/api/v1/search/hotels')
        .query({
          checkIn: '2026-10-20',
          checkOut: '2026-10-22',
          city: 'mumbai',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.items.length).toBe(1);
      expect(res.body.data.items[0].city).toBe('Mumbai');
      expect(res.body.data.items[0].hotelName).toBe('Stayora Grand Palace');
    });

    it('should filter hotels by partial name search', async () => {
      const res = await request(server)
        .get('/api/v1/search/hotels')
        .query({
          checkIn: '2026-10-20',
          checkOut: '2026-10-22',
          search: 'bayfront',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.items.length).toBe(1);
      expect(res.body.data.items[0].hotelName).toBe('Stayora Bayfront Resort');
    });

    it('should return 200 with empty list when no hotels match criteria', async () => {
      const res = await request(server)
        .get('/api/v1/search/hotels')
        .query({
          checkIn: '2026-10-20',
          checkOut: '2026-10-22',
          city: 'Atlantis',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toEqual([]);
      expect(res.body.data.meta.total).toBe(0);
    });
  });

  // ===========================================================================
  // 3. Guest Capacity Filtering
  // ===========================================================================
  describe('Guest Capacity Filtering', () => {
    it('should return all room types when guests = 2', async () => {
      const res = await request(server)
        .get('/api/v1/search/hotels')
        .query({
          checkIn: '2026-10-20',
          checkOut: '2026-10-22',
          city: 'Mumbai',
          guests: 2,
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      const hotel = res.body.data.items[0];
      const roomTypeNames = hotel.roomTypes.map((rt: any) => rt.name);
      // Mumbai has Classic Heritage (cap 2), Palace Sea View (cap 3), Presidential Royal (cap 4)
      expect(roomTypeNames).toContain('Classic Heritage Room');
      expect(roomTypeNames).toContain('Palace Sea View Suite');
      expect(roomTypeNames).toContain('Presidential Royal Suite');
    });

    it('should exclude room types with capacity < guests (guests = 3)', async () => {
      const res = await request(server)
        .get('/api/v1/search/hotels')
        .query({
          checkIn: '2026-10-20',
          checkOut: '2026-10-22',
          city: 'Mumbai',
          guests: 3,
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      const hotel = res.body.data.items[0];
      const roomTypeNames = hotel.roomTypes.map((rt: any) => rt.name);
      // Classic Heritage (cap 2) should NOT be returned
      expect(roomTypeNames).not.toContain('Classic Heritage Room');
      // Palace Sea View (cap 3) and Presidential (cap 4) should be returned
      expect(roomTypeNames).toContain('Palace Sea View Suite');
      expect(roomTypeNames).toContain('Presidential Royal Suite');
    });

    it('should exclude hotel if no room type satisfies guest capacity (guests = 10)', async () => {
      const res = await request(server)
        .get('/api/v1/search/hotels')
        .query({
          checkIn: '2026-10-20',
          checkOut: '2026-10-22',
          city: 'Mumbai',
          guests: 10,
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toEqual([]);
      expect(res.body.data.meta.total).toBe(0);
    });
  });

  // ===========================================================================
  // 4. Availability & Half-Open Date Overlap Semantics
  // The database has a seeded booking:
  // Hotel: Mumbai, Room: 101 (Classic Heritage Room)
  // Check-In: 2026-10-10, Check-Out: 2026-10-12
  // Total Classic Heritage Rooms = 3 (101, 102, 103)
  // ===========================================================================
  describe('Availability & Date Overlap Semantics [checkIn, checkOut)', () => {
    it('should correctly reduce available rooms during overlapping dates (2026-10-10 -> 2026-10-12)', async () => {
      const res = await request(server)
        .get('/api/v1/search/hotels')
        .query({
          checkIn: '2026-10-10',
          checkOut: '2026-10-12',
          city: 'Mumbai',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      const hotel = res.body.data.items[0];
      const heritageRoom = hotel.roomTypes.find((rt: any) => rt.slug === 'classic-heritage-room');
      expect(heritageRoom).toBeDefined();
      // Total 3 operational rooms, 1 booked (Room 101) -> 2 available
      expect(heritageRoom.totalOperationalRooms).toBe(3);
      expect(heritageRoom.availableRooms).toBe(2);
    });

    it('should NOT overlap when requested checkIn == existing checkOut (2026-10-12 -> 2026-10-15)', async () => {
      const res = await request(server)
        .get('/api/v1/search/hotels')
        .query({
          checkIn: '2026-10-12',
          checkOut: '2026-10-15',
          city: 'Mumbai',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      const hotel = res.body.data.items[0];
      const heritageRoom = hotel.roomTypes.find((rt: any) => rt.slug === 'classic-heritage-room');
      expect(heritageRoom).toBeDefined();
      // Room 101 checked out on 2026-10-12, so available again on 2026-10-12!
      expect(heritageRoom.availableRooms).toBe(3);
    });

    it('should NOT overlap when requested checkOut == existing checkIn (2026-10-08 -> 2026-10-10)', async () => {
      const res = await request(server)
        .get('/api/v1/search/hotels')
        .query({
          checkIn: '2026-10-08',
          checkOut: '2026-10-10',
          city: 'Mumbai',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      const hotel = res.body.data.items[0];
      const heritageRoom = hotel.roomTypes.find((rt: any) => rt.slug === 'classic-heritage-room');
      expect(heritageRoom).toBeDefined();
      // Checkout is on 2026-10-10 morning, existing checkin is 2026-10-10 afternoon -> NO overlap!
      expect(heritageRoom.availableRooms).toBe(3);
    });

    it('should overlap for partial overlap (2026-10-11 -> 2026-10-14)', async () => {
      const res = await request(server)
        .get('/api/v1/search/hotels')
        .query({
          checkIn: '2026-10-11',
          checkOut: '2026-10-14',
          city: 'Mumbai',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      const hotel = res.body.data.items[0];
      const heritageRoom = hotel.roomTypes.find((rt: any) => rt.slug === 'classic-heritage-room');
      expect(heritageRoom).toBeDefined();
      expect(heritageRoom.availableRooms).toBe(2);
    });

    it('should overlap for enclosing range (2026-10-05 -> 2026-10-15)', async () => {
      const res = await request(server)
        .get('/api/v1/search/hotels')
        .query({
          checkIn: '2026-10-05',
          checkOut: '2026-10-15',
          city: 'Mumbai',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      const hotel = res.body.data.items[0];
      const heritageRoom = hotel.roomTypes.find((rt: any) => rt.slug === 'classic-heritage-room');
      expect(heritageRoom).toBeDefined();
      expect(heritageRoom.availableRooms).toBe(2);
    });
  });

  // ===========================================================================
  // 5. Operational Room Status Integrity
  // ===========================================================================
  describe('Operational Status Effect on Availability', () => {
    it('should exclude rooms placed under MAINTENANCE from available inventory', async () => {
      // Place room 103 under MAINTENANCE
      await prisma.room.update({
        where: { id: room103Id },
        data: { operationalStatus: 'MAINTENANCE' },
      });

      try {
        // Query non-overlapping dates: previously 3 available, should now be 2
        const res = await request(server)
          .get('/api/v1/search/hotels')
          .query({
            checkIn: '2026-10-20',
            checkOut: '2026-10-22',
            city: 'Mumbai',
          })
          .expect(200);

        const hotel = res.body.data.items[0];
        const heritageRoom = hotel.roomTypes.find((rt: any) => rt.slug === 'classic-heritage-room');
        expect(heritageRoom.totalOperationalRooms).toBe(2);
        expect(heritageRoom.availableRooms).toBe(2);
      } finally {
        // Restore room 103 to AVAILABLE
        await prisma.room.update({
          where: { id: room103Id },
          data: { operationalStatus: 'AVAILABLE' },
        });
      }

      // Verify availability is restored to 3
      const resRestored = await request(server)
        .get('/api/v1/search/hotels')
        .query({
          checkIn: '2026-10-20',
          checkOut: '2026-10-22',
          city: 'Mumbai',
        })
        .expect(200);

      const hotelRestored = resRestored.body.data.items[0];
      const heritageRestored = hotelRestored.roomTypes.find((rt: any) => rt.slug === 'classic-heritage-room');
      expect(heritageRestored.totalOperationalRooms).toBe(3);
      expect(heritageRestored.availableRooms).toBe(3);
    });
  });

  // ===========================================================================
  // 6. Direct Hotel & RoomType Availability Endpoints
  // ===========================================================================
  describe('Direct Availability Endpoints', () => {
    it('GET /api/v1/availability/hotels/:hotelId should return room availability for specific hotel', async () => {
      const res = await request(server)
        .get(`/api/v1/availability/hotels/${HOTEL_MUMBAI_ID}`)
        .query({
          checkIn: '2026-10-10',
          checkOut: '2026-10-12',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.hotelId).toBe(HOTEL_MUMBAI_ID);
      expect(res.body.data.hotelName).toBe('Stayora Grand Palace');
      expect(res.body.data.roomTypes.length).toBe(3);
    });

    it('GET /api/v1/availability/hotels/:hotelId should return 404 for unknown hotel ID', async () => {
      const res = await request(server)
        .get('/api/v1/availability/hotels/00000000-0000-0000-0000-000000000000')
        .query({
          checkIn: '2026-10-10',
          checkOut: '2026-10-12',
        })
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('HOTEL_NOT_FOUND');
    });

    it('GET /api/v1/availability/room-types/:roomTypeId should return specific room type availability', async () => {
      const res = await request(server)
        .get(`/api/v1/availability/room-types/${mumbaiStandardRoomTypeId}`)
        .query({
          checkIn: '2026-10-10',
          checkOut: '2026-10-12',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.roomTypeId).toBe(mumbaiStandardRoomTypeId);
      expect(res.body.data.availableRooms).toBe(2);
      expect(res.body.data.totalOperationalRooms).toBe(3);
      expect(res.body.data.hasAvailability).toBe(true);
      expect(res.body.data.totalNights).toBe(2);
    });

    it('GET /api/v1/availability/room-types/:roomTypeId should return 404 for unknown room type ID', async () => {
      const res = await request(server)
        .get('/api/v1/availability/room-types/00000000-0000-0000-0000-000000000000')
        .query({
          checkIn: '2026-10-10',
          checkOut: '2026-10-12',
        })
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('ROOM_TYPE_NOT_FOUND');
    });
  });

  // ===========================================================================
  // 7. Pagination and Sorting
  // ===========================================================================
  describe('Pagination & Sorting', () => {
    it('should paginate results properly with limit=1', async () => {
      const res = await request(server)
        .get('/api/v1/search/hotels')
        .query({
          checkIn: '2026-10-20',
          checkOut: '2026-10-22',
          page: 1,
          limit: 1,
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.items.length).toBe(1);
      expect(res.body.data.meta.limit).toBe(1);
      expect(res.body.data.meta.totalPages).toBeGreaterThanOrEqual(2);
    });

    it('should sort results by hotel name ASC and DESC', async () => {
      const resAsc = await request(server)
        .get('/api/v1/search/hotels')
        .query({
          checkIn: '2026-10-20',
          checkOut: '2026-10-22',
          sortBy: 'NAME',
          sortOrder: 'ASC',
        })
        .expect(200);

      const resDesc = await request(server)
        .get('/api/v1/search/hotels')
        .query({
          checkIn: '2026-10-20',
          checkOut: '2026-10-22',
          sortBy: 'NAME',
          sortOrder: 'DESC',
        })
        .expect(200);

      const firstAscName = resAsc.body.data.items[0].hotelName;
      const firstDescName = resDesc.body.data.items[0].hotelName;
      expect(firstAscName).not.toBe(firstDescName);
    });
  });

  // ===========================================================================
  // 8. Security & Data Isolation
  // ===========================================================================
  describe('Security & Data Exposure', () => {
    it('should NOT leak internal manager assignments, user credentials, or audit logs', async () => {
      const res = await request(server)
        .get('/api/v1/search/hotels')
        .query({
          checkIn: '2026-10-20',
          checkOut: '2026-10-22',
        })
        .expect(200);

      const rawJson = JSON.stringify(res.body);
      expect(rawJson).not.toContain('passwordHash');
      expect(rawJson).not.toContain('managers');
      expect(rawJson).not.toContain('auditLog');
      expect(rawJson).not.toContain('userId');
    });
  });
});
