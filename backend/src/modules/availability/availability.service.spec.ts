import { HttpStatus } from '@nestjs/common';
import { AvailabilityService } from './availability.service';
import { PrismaService } from '../../prisma/prisma.service';
import { DomainException } from '../../common/exceptions/domain.exception';
import { SearchSortBy, SearchSortOrder } from './types/search-sort-by.enum';

describe('AvailabilityService Unit Tests', () => {
  let service: AvailabilityService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      hotel: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      roomType: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      room: {
        findMany: jest.fn(),
      },
      bookingRoom: {
        findMany: jest.fn(),
      },
    };

    service = new AvailabilityService(prisma as unknown as PrismaService);
  });

  // ===========================================================================
  // 1. Date Validation Tests (Step 27)
  // ===========================================================================
  describe('validateDateRange', () => {
    it('should throw when checkIn is missing', () => {
      expect(() => service.validateDateRange('', '2026-10-15')).toThrow(
        DomainException,
      );
    });

    it('should throw when checkOut is missing', () => {
      expect(() => service.validateDateRange('2026-10-10', '')).toThrow(
        DomainException,
      );
    });

    it('should throw when date format is invalid', () => {
      expect(() =>
        service.validateDateRange('not-a-date', '2026-10-15'),
      ).toThrow(DomainException);
    });

    it('should throw when checkOut equals checkIn', () => {
      expect(() =>
        service.validateDateRange('2026-10-15', '2026-10-15'),
      ).toThrow(DomainException);
    });

    it('should throw when checkOut is before checkIn', () => {
      expect(() =>
        service.validateDateRange('2026-10-20', '2026-10-15'),
      ).toThrow(DomainException);
    });

    it('should throw when checkIn date is in the past', () => {
      expect(() =>
        service.validateDateRange('2020-01-01', '2020-01-05'),
      ).toThrow(DomainException);
    });

    it('should return valid parsed dates and computed nights for future range', () => {
      const result = service.validateDateRange('2026-10-10', '2026-10-15');
      expect(result.nights).toBe(5);
      expect(result.checkInDate).toEqual(new Date('2026-10-10T00:00:00.000Z'));
      expect(result.checkOutDate).toEqual(new Date('2026-10-15T00:00:00.000Z'));
    });
  });

  // ===========================================================================
  // 2. Overlap Tests (Step 28 - Half-Open [checkIn, checkOut) Semantics)
  // ===========================================================================
  describe('isDateRangeOverlapping', () => {
    const parse = (d: string) => new Date(d + 'T00:00:00.000Z');

    it('should NOT overlap when Existing: Oct 10 -> Oct 12 and Requested: Oct 12 -> Oct 15', () => {
      const overlap = service.isDateRangeOverlapping(
        parse('2026-10-10'),
        parse('2026-10-12'),
        parse('2026-10-12'),
        parse('2026-10-15'),
      );
      expect(overlap).toBe(false);
    });

    it('should overlap when Existing: Oct 10 -> Oct 20 and Requested: Oct 12 -> Oct 15 (Contained)', () => {
      const overlap = service.isDateRangeOverlapping(
        parse('2026-10-10'),
        parse('2026-10-20'),
        parse('2026-10-12'),
        parse('2026-10-15'),
      );
      expect(overlap).toBe(true);
    });

    it('should overlap when Existing: Oct 12 -> Oct 15 and Requested: Oct 10 -> Oct 20 (Container)', () => {
      const overlap = service.isDateRangeOverlapping(
        parse('2026-10-12'),
        parse('2026-10-15'),
        parse('2026-10-10'),
        parse('2026-10-20'),
      );
      expect(overlap).toBe(true);
    });

    it('should NOT overlap when Existing: Oct 10 -> Oct 15 and Requested: Oct 15 -> Oct 20', () => {
      const overlap = service.isDateRangeOverlapping(
        parse('2026-10-10'),
        parse('2026-10-15'),
        parse('2026-10-15'),
        parse('2026-10-20'),
      );
      expect(overlap).toBe(false);
    });

    it('should overlap when Existing: Oct 10 -> Oct 15 and Requested: Oct 10 -> Oct 15 (Exact Match)', () => {
      const overlap = service.isDateRangeOverlapping(
        parse('2026-10-10'),
        parse('2026-10-15'),
        parse('2026-10-10'),
        parse('2026-10-15'),
      );
      expect(overlap).toBe(true);
    });
  });

  // ===========================================================================
  // 3. Availability Calculation Tests (Step 29)
  // ===========================================================================
  describe('getRoomTypeAvailability', () => {
    const roomTypeId = 'rt-100';
    const checkIn = new Date('2026-10-20T00:00:00.000Z');
    const checkOut = new Date('2026-10-25T00:00:00.000Z');

    it('should return available = 1 when 1 operational room and 0 conflicting bookings', async () => {
      prisma.roomType.findFirst.mockResolvedValue({
        id: roomTypeId,
        hotelId: 'hotel-1',
        isActive: true,
      });
      prisma.room.findMany.mockResolvedValue([{ id: 'room-1' }]);
      prisma.bookingRoom.findMany.mockResolvedValue([]); // no conflicts

      const result = await service.getRoomTypeAvailability(
        roomTypeId,
        checkIn,
        checkOut,
      );

      expect(result.totalOperationalRooms).toBe(1);
      expect(result.occupiedRooms).toBe(0);
      expect(result.availableRooms).toBe(1);
      expect(result.availableRoomIds).toEqual(['room-1']);
    });

    it('should return available = 0 when 1 operational room and 1 conflicting booking', async () => {
      prisma.roomType.findFirst.mockResolvedValue({
        id: roomTypeId,
        hotelId: 'hotel-1',
        isActive: true,
      });
      prisma.room.findMany.mockResolvedValue([{ id: 'room-1' }]);
      prisma.bookingRoom.findMany.mockResolvedValue([{ roomId: 'room-1' }]); // Room 1 blocked!

      const result = await service.getRoomTypeAvailability(
        roomTypeId,
        checkIn,
        checkOut,
      );

      expect(result.totalOperationalRooms).toBe(1);
      expect(result.occupiedRooms).toBe(1);
      expect(result.availableRooms).toBe(0);
      expect(result.availableRoomIds).toEqual([]);
    });

    it('should return available = 1 when 2 operational rooms and 1 conflicting booking', async () => {
      prisma.roomType.findFirst.mockResolvedValue({
        id: roomTypeId,
        hotelId: 'hotel-1',
        isActive: true,
      });
      prisma.room.findMany.mockResolvedValue([
        { id: 'room-1' },
        { id: 'room-2' },
      ]);
      prisma.bookingRoom.findMany.mockResolvedValue([{ roomId: 'room-1' }]); // Room 1 blocked

      const result = await service.getRoomTypeAvailability(
        roomTypeId,
        checkIn,
        checkOut,
      );

      expect(result.totalOperationalRooms).toBe(2);
      expect(result.occupiedRooms).toBe(1);
      expect(result.availableRooms).toBe(1);
      expect(result.availableRoomIds).toEqual(['room-2']);
    });

    it('should return available = 0 when 2 operational rooms and 2 conflicting bookings', async () => {
      prisma.roomType.findFirst.mockResolvedValue({
        id: roomTypeId,
        hotelId: 'hotel-1',
        isActive: true,
      });
      prisma.room.findMany.mockResolvedValue([
        { id: 'room-1' },
        { id: 'room-2' },
      ]);
      prisma.bookingRoom.findMany.mockResolvedValue([
        { roomId: 'room-1' },
        { roomId: 'room-2' },
      ]); // both blocked

      const result = await service.getRoomTypeAvailability(
        roomTypeId,
        checkIn,
        checkOut,
      );

      expect(result.availableRooms).toBe(0);
    });

    it('should return available = 0 when room status is MAINTENANCE or OUT_OF_SERVICE (excluded from operationalRooms)', async () => {
      prisma.roomType.findFirst.mockResolvedValue({
        id: roomTypeId,
        hotelId: 'hotel-1',
        isActive: true,
      });
      // Prisma query filters operationalStatus: 'AVAILABLE', so rooms in maintenance return 0 operational rooms
      prisma.room.findMany.mockResolvedValue([]);

      const result = await service.getRoomTypeAvailability(
        roomTypeId,
        checkIn,
        checkOut,
      );

      expect(result.totalOperationalRooms).toBe(0);
      expect(result.availableRooms).toBe(0);
    });
  });

  // ===========================================================================
  // 4. Hotel Search & Discovery Tests (Step 31)
  // ===========================================================================
  describe('searchAvailableHotels', () => {
    it('should filter hotels by destination city and check-in dates', async () => {
      prisma.hotel.count.mockResolvedValue(1);
      prisma.hotel.findMany.mockResolvedValue([
        {
          id: 'hotel-1',
          name: 'Stayora Mumbai Palace',
          slug: 'stayora-mumbai-palace',
          description: 'Heritage hotel.',
          starRating: 5,
          addressLine1: 'Marine Drive',
          addressLine2: null,
          city: 'Mumbai',
          state: 'Maharashtra',
          country: 'India',
          postalCode: '400001',
          latitude: null,
          longitude: null,
          phone: '+912266653300',
          email: 'mumbai@stayora.com',
          checkInTime: '14:00',
          checkOutTime: '11:00',
          roomTypes: [
            {
              id: 'rt-1',
              name: 'Deluxe Suite',
              slug: 'deluxe-suite',
              description: 'Suite room',
              maxOccupancy: 3,
              maxAdults: 2,
              maxChildren: 1,
              basePriceCents: BigInt(500000),
              currency: 'INR',
              bedType: 'KING',
              sizeSqMeters: null,
              amenities: [],
            },
          ],
        },
      ]);

      // Mock getRoomTypeAvailability for rt-1
      prisma.roomType.findFirst.mockResolvedValue({
        id: 'rt-1',
        hotelId: 'hotel-1',
        isActive: true,
      });
      prisma.room.findMany.mockResolvedValue([{ id: 'room-1' }]);
      prisma.bookingRoom.findMany.mockResolvedValue([]);

      const res = await service.searchAvailableHotels({
        city: 'Mumbai',
        checkIn: '2026-10-20',
        checkOut: '2026-10-22',
        guests: 2,
      });

      expect(res.items).toHaveLength(1);
      expect(res.items[0].city).toBe('Mumbai');
      expect(res.items[0].roomTypes[0].availableRooms).toBe(1);
      expect(res.meta.totalNights).toBe(2);
      expect(res.meta.guests).toBe(2);
    });
  });
});
