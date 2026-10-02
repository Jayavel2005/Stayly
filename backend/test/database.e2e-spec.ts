import { PrismaClient } from '@prisma/client';

describe('PostgreSQL + Prisma Database Foundation (Integrity Tests)', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Core Entities & Seed Verification', () => {
    it('should find seeded users with correct roles and hashed passwords', async () => {
      const customer = await prisma.user.findFirst({
        where: { email: 'customer@stayora.com' },
      });
      const manager = await prisma.user.findFirst({
        where: { email: 'manager@stayora.com' },
      });
      const admin = await prisma.user.findFirst({
        where: { email: 'admin@stayora.com' },
      });

      expect(customer).not.toBeNull();
      expect(customer?.role).toBe('CUSTOMER');
      expect(customer?.passwordHash).toMatch(/^\$2[aby]\$\d+\$/);

      expect(manager).not.toBeNull();
      expect(manager?.role).toBe('HOTEL_MANAGER');

      expect(admin).not.toBeNull();
      expect(admin?.role).toBe('ADMIN');
    });

    it('should verify hotels, room types, and physical rooms hierarchy', async () => {
      const hotel = await prisma.hotel.findFirst({
        where: { slug: 'stayora-grand-palace' },
        include: {
          roomTypes: {
            include: {
              rooms: true,
              amenities: { include: { amenity: true } },
            },
          },
          managers: true,
        },
      });

      expect(hotel).not.toBeNull();
      expect(hotel?.starRating).toBe(5);
      expect(hotel?.roomTypes.length).toBeGreaterThanOrEqual(3);

      const standardType = hotel?.roomTypes.find(
        (rt) => rt.slug === 'classic-heritage-room',
      );
      expect(standardType).toBeDefined();
      expect(standardType?.rooms.length).toBeGreaterThanOrEqual(3);
      expect(standardType?.amenities.length).toBeGreaterThanOrEqual(1);

      // Verify manager assignment via join table
      expect(hotel?.managers.length).toBeGreaterThanOrEqual(1);
      expect(hotel?.managers[0].isPrimary).toBe(true);
    });
  });

  describe('Historical Pricing Preservation', () => {
    it('should freeze booking pricing snapshot independently of room type base price updates', async () => {
      const booking = await prisma.booking.findFirst({
        where: { bookingReference: 'STY-202610-0001' },
        include: { priceSnapshot: true },
      });

      expect(booking).not.toBeNull();
      expect(booking?.priceSnapshot).not.toBeNull();
      const originalSnapshotRate = booking?.priceSnapshot?.baseRateCents;

      // Update room type price to simulate rate inflation
      const roomType = await prisma.roomType.findFirst({
        where: { slug: 'classic-heritage-room' },
      });
      expect(roomType).not.toBeNull();

      const newRate = (roomType!.basePriceCents as bigint) + BigInt(200000);
      await prisma.roomType.update({
        where: { id: roomType!.id },
        data: { basePriceCents: newRate },
      });

      // Reload booking and price snapshot
      const reloadedBooking = await prisma.booking.findUnique({
        where: { id: booking!.id },
        include: { priceSnapshot: true },
      });

      // Snapshot must remain completely unchanged
      expect(reloadedBooking?.priceSnapshot?.baseRateCents).toEqual(
        originalSnapshotRate,
      );
      expect(reloadedBooking?.totalAmountCents).toEqual(
        booking?.totalAmountCents,
      );

      // Revert room type rate back
      await prisma.roomType.update({
        where: { id: roomType!.id },
        data: { basePriceCents: roomType!.basePriceCents },
      });
    });
  });

  describe('Referential Integrity & Restrictive Deletion Actions', () => {
    it('should reject deletion of User with active Bookings (ON DELETE RESTRICT)', async () => {
      const customer = await prisma.user.findFirst({
        where: { email: 'customer@stayora.com' },
      });
      expect(customer).not.toBeNull();

      // Deleting user must fail because booking references customer
      await expect(
        prisma.user.delete({
          where: { id: customer!.id },
        }),
      ).rejects.toThrow();
    });

    it('should reject deletion of Hotel with existing RoomTypes (ON DELETE RESTRICT)', async () => {
      const hotel = await prisma.hotel.findFirst({
        where: { slug: 'stayora-grand-palace' },
      });
      expect(hotel).not.toBeNull();

      await expect(
        prisma.hotel.delete({
          where: { id: hotel!.id },
        }),
      ).rejects.toThrow();
    });

    it('should reject deletion of Room with allocated BookingRooms (ON DELETE RESTRICT)', async () => {
      const allocatedRoom = await prisma.bookingRoom.findFirst();
      expect(allocatedRoom).not.toBeNull();

      await expect(
        prisma.room.delete({
          where: { id: allocatedRoom!.roomId },
        }),
      ).rejects.toThrow();
    });
  });

  describe('PostgreSQL Exclusion Constraint: Double-Booking Prevention', () => {
    it('should enforce half-open interval overlap rejection at database engine level', async () => {
      // Find an available room
      const room = await prisma.room.findFirst({
        where: { roomNumber: '201' },
      });
      expect(room).not.toBeNull();

      const customer = await prisma.user.findFirst({
        where: { email: 'customer@stayora.com' },
      });
      const hotel = await prisma.hotel.findFirst();

      // Create test booking 1: [2026-11-10, 2026-11-15)
      const booking1 = await prisma.booking.create({
        data: {
          bookingReference: 'TEST-OVR-001',
          customerId: customer!.id,
          hotelId: hotel!.id,
          status: 'CONFIRMED',
          checkInDate: new Date('2026-11-10'),
          checkOutDate: new Date('2026-11-15'),
          totalNights: 5,
          totalAmountCents: BigInt(500000),
          bookingRooms: {
            create: {
              roomId: room!.id,
              roomTypeId: room!.roomTypeId,
              checkInDate: new Date('2026-11-10'),
              checkOutDate: new Date('2026-11-15'),
              status: 'RESERVED',
            },
          },
        },
      });

      // Create test booking 2 with overlapping dates: [2026-11-12, 2026-11-16)
      // Attempting to allocate the same physical room MUST fail via GiST exclusion constraint!
      const booking2 = await prisma.booking.create({
        data: {
          bookingReference: 'TEST-OVR-002',
          customerId: customer!.id,
          hotelId: hotel!.id,
          status: 'PENDING',
          checkInDate: new Date('2026-11-12'),
          checkOutDate: new Date('2026-11-16'),
          totalNights: 4,
          totalAmountCents: BigInt(400000),
        },
      });

      // Allocate overlapping room to booking2 -> Expect exclusion error!
      await expect(
        prisma.bookingRoom.create({
          data: {
            bookingId: booking2.id,
            roomId: room!.id,
            roomTypeId: room!.roomTypeId,
            checkInDate: new Date('2026-11-12'),
            checkOutDate: new Date('2026-11-16'),
            status: 'RESERVED',
          },
        }),
      ).rejects.toThrow();

      // Adjacent booking on checkout date [2026-11-15, 2026-11-18) MUST SUCCEED (half-open [) interval)
      const adjacentAllocation = await prisma.bookingRoom.create({
        data: {
          bookingId: booking2.id,
          roomId: room!.id,
          roomTypeId: room!.roomTypeId,
          checkInDate: new Date('2026-11-15'),
          checkOutDate: new Date('2026-11-18'),
          status: 'RESERVED',
        },
      });
      expect(adjacentAllocation.id).toBeDefined();

      // Cleanup test records
      await prisma.bookingRoom.deleteMany({
        where: { bookingId: { in: [booking1.id, booking2.id] } },
      });
      await prisma.booking.deleteMany({
        where: { id: { in: [booking1.id, booking2.id] } },
      });
    });
  });

  describe('PostgreSQL Domain CHECK Constraints', () => {
    it('should reject invalid user role via CHECK constraint', async () => {
      await expect(
        prisma.$executeRawUnsafe(`
          INSERT INTO users (id, email, password_hash, first_name, last_name, role)
          VALUES (gen_random_uuid(), 'badrole@stayora.com', 'hash', 'Bad', 'Role', 'SUPER_ADMIN')
        `),
      ).rejects.toThrow();
    });

    it('should reject invalid star rating via CHECK constraint', async () => {
      await expect(
        prisma.$executeRawUnsafe(`
          INSERT INTO hotels (id, name, slug, description, star_rating, address_line1, city, state, country, postal_code, phone, email)
          VALUES (gen_random_uuid(), 'Invalid Star Hotel', 'invalid-star', 'Desc', 7, 'Addr', 'City', 'State', 'India', '400001', '123', 'bad@hotel.com')
        `),
      ).rejects.toThrow();
    });

    it('should reject booking where check_in_date >= check_out_date', async () => {
      const customer = await prisma.user.findFirst();
      const hotel = await prisma.hotel.findFirst();

      await expect(
        prisma.$executeRawUnsafe(`
          INSERT INTO bookings (id, booking_reference, customer_id, hotel_id, check_in_date, check_out_date, total_nights, total_amount_cents)
          VALUES (gen_random_uuid(), 'INVALID-DATES', '${customer!.id}', '${hotel!.id}', '2026-12-10', '2026-12-05', -5, 1000)
        `),
      ).rejects.toThrow();
    });
  });
});
