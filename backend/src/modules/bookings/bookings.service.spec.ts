import { Test, TestingModule } from '@nestjs/testing';
import { BookingsService } from './bookings.service';
import { PrismaService } from '../../prisma/prisma.service';
import { HotelAuthorizationService } from '../hotels/authorization/hotel-authorization.service';
import { AvailabilityService } from '../availability/availability.service';
import { DomainException } from '../../common/exceptions/domain.exception';
import { BookingStatus, BookingRoomStatus } from './types/booking-status.enum';
import { UserRole } from '../auth/types/user-role.enum';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';

describe('BookingsService Unit Tests', () => {
  let service: BookingsService;
  let prisma: any;
  let hotelAuthService: any;
  let availabilityService: any;

  const mockHotelId = '44444444-4444-4444-8444-444444444444';
  const mockRoomTypeId = '57391b9b-ed2d-4e3d-bb09-63728b53254f';
  const mockCustomerId = '11111111-1111-4111-8111-111111111111';
  const mockManagerId = '22222222-2222-4222-8222-222222222222';
  const mockBookingId = '99999999-9999-4999-8999-999999999999';

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn(),
      booking: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      bookingRoom: {
        updateMany: jest.fn(),
      },
    };

    hotelAuthService = {
      assertManagerAccess: jest.fn(),
      getManagedHotelIds: jest.fn(),
    };

    availabilityService = {
      validateDateRange: jest.fn().mockReturnValue({
        checkInDate: new Date('2026-10-20T00:00:00.000Z'),
        checkOutDate: new Date('2026-10-23T00:00:00.000Z'),
        nights: 3,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        { provide: PrismaService, useValue: prisma },
        { provide: HotelAuthorizationService, useValue: hotelAuthService },
        { provide: AvailabilityService, useValue: availabilityService },
      ],
    }).compile();

    service = module.get<BookingsService>(BookingsService);
  });

  // ===========================================================================
  // 1. Transactional Booking Creation & Validation
  // ===========================================================================
  describe('createBooking', () => {
    const validDto = {
      hotelId: mockHotelId,
      roomTypeId: mockRoomTypeId,
      checkIn: '2026-10-20',
      checkOut: '2026-10-23',
      guests: 2,
      rooms: 1,
    };

    it('should throw 404 if hotel is not found or inactive', async () => {
      prisma.$transaction.mockImplementation(async (callback: any) => {
        const tx = {
          hotel: { findFirst: jest.fn().mockResolvedValue(null) },
        };
        return callback(tx);
      });

      await expect(
        service.createBooking(mockCustomerId, validDto),
      ).rejects.toThrow(
        expect.objectContaining({
          code: 'HOTEL_NOT_FOUND',
          status: 404,
        }),
      );
    });

    it('should throw 404 if room category is not found or inactive', async () => {
      prisma.$transaction.mockImplementation(async (callback: any) => {
        const tx = {
          hotel: { findFirst: jest.fn().mockResolvedValue({ id: mockHotelId }) },
          roomType: { findFirst: jest.fn().mockResolvedValue(null) },
        };
        return callback(tx);
      });

      await expect(
        service.createBooking(mockCustomerId, validDto),
      ).rejects.toThrow(
        expect.objectContaining({
          code: 'ROOM_TYPE_NOT_FOUND',
          status: 404,
        }),
      );
    });

    it('should throw 400 if room category belongs to another hotel', async () => {
      prisma.$transaction.mockImplementation(async (callback: any) => {
        const tx = {
          hotel: { findFirst: jest.fn().mockResolvedValue({ id: mockHotelId }) },
          roomType: {
            findFirst: jest
              .fn()
              .mockResolvedValue({ id: mockRoomTypeId, hotelId: 'other-hotel-id' }),
          },
        };
        return callback(tx);
      });

      await expect(
        service.createBooking(mockCustomerId, validDto),
      ).rejects.toThrow(
        expect.objectContaining({
          code: 'HOTEL_ROOM_TYPE_MISMATCH',
          status: 400,
        }),
      );
    });

    it('should throw 400 if guest count exceeds room category capacity', async () => {
      prisma.$transaction.mockImplementation(async (callback: any) => {
        const tx = {
          hotel: { findFirst: jest.fn().mockResolvedValue({ id: mockHotelId }) },
          roomType: {
            findFirst: jest.fn().mockResolvedValue({
              id: mockRoomTypeId,
              hotelId: mockHotelId,
              maxOccupancy: 1, // capacity 1 vs 2 guests
            }),
          },
        };
        return callback(tx);
      });

      await expect(
        service.createBooking(mockCustomerId, validDto),
      ).rejects.toThrow(
        expect.objectContaining({
          code: 'CAPACITY_EXCEEDED',
          status: 400,
        }),
      );
    });

    it('should throw 409 if no physical rooms are operationally available', async () => {
      prisma.$transaction.mockImplementation(async (callback: any) => {
        const tx = {
          hotel: { findFirst: jest.fn().mockResolvedValue({ id: mockHotelId }) },
          roomType: {
            findFirst: jest.fn().mockResolvedValue({
              id: mockRoomTypeId,
              hotelId: mockHotelId,
              maxOccupancy: 2,
            }),
          },
          $queryRaw: jest.fn().mockResolvedValue([]), // 0 operational rooms
        };
        return callback(tx);
      });

      await expect(
        service.createBooking(mockCustomerId, validDto),
      ).rejects.toThrow(
        expect.objectContaining({
          code: 'ROOM_NOT_AVAILABLE',
          status: 409,
        }),
      );
    });

    it('should throw 409 if all physical rooms have conflicting active allocations', async () => {
      prisma.$transaction.mockImplementation(async (callback: any) => {
        const tx = {
          hotel: { findFirst: jest.fn().mockResolvedValue({ id: mockHotelId }) },
          roomType: {
            findFirst: jest.fn().mockResolvedValue({
              id: mockRoomTypeId,
              hotelId: mockHotelId,
              maxOccupancy: 2,
            }),
          },
          $queryRaw: jest
            .fn()
            .mockResolvedValueOnce([
              { id: 'room-101', room_number: '101', floor: 1 },
            ])
            .mockResolvedValueOnce([
              { room_id: 'room-101' }, // Conflicting allocation
            ]),
        };
        return callback(tx);
      });

      await expect(
        service.createBooking(mockCustomerId, validDto),
      ).rejects.toThrow(
        expect.objectContaining({
          code: 'ROOM_NOT_AVAILABLE',
          status: 409,
        }),
      );
    });

    it('should successfully create booking and allocate available physical room', async () => {
      const mockCreatedBooking = {
        id: mockBookingId,
        bookingReference: 'STY-202610-A1B2C3',
        status: BookingStatus.PENDING,
        checkInDate: new Date('2026-10-20T00:00:00.000Z'),
        checkOutDate: new Date('2026-10-23T00:00:00.000Z'),
        totalNights: 3,
        totalGuests: 2,
        totalAmountCents: BigInt(1350000),
        currency: 'INR',
        holdExpiresAt: new Date('2026-10-20T00:15:00.000Z'),
        cancellationReason: null,
        cancelledAt: null,
        checkedInAt: null,
        checkedOutAt: null,
        createdAt: new Date('2026-10-01T12:00:00.000Z'),
        updatedAt: new Date('2026-10-01T12:00:00.000Z'),
        hotel: {
          id: mockHotelId,
          name: 'Stayora Grand Palace',
          slug: 'stayora-grand-palace',
          city: 'Mumbai',
        },
        bookingRooms: [
          {
            roomId: 'room-102',
            roomTypeId: mockRoomTypeId,
            room: { id: 'room-102', roomNumber: '102', floor: 1 },
            roomType: {
              id: mockRoomTypeId,
              name: 'Deluxe Heritage',
              slug: 'deluxe-heritage',
            },
          },
        ],
        priceSnapshot: {
          baseRateCents: BigInt(450000),
          totalNights: 3,
          grossRoomCents: BigInt(1350000),
          taxCents: BigInt(0),
          serviceFeeCents: BigInt(0),
          discountCents: BigInt(0),
          netAmountCents: BigInt(1350000),
          currency: 'INR',
        },
      };

      prisma.$transaction.mockImplementation(async (callback: any) => {
        const tx = {
          hotel: {
            findFirst: jest.fn().mockResolvedValue({
              id: mockHotelId,
              name: 'Stayora Grand Palace',
              slug: 'stayora-grand-palace',
              city: 'Mumbai',
            }),
          },
          roomType: {
            findFirst: jest.fn().mockResolvedValue({
              id: mockRoomTypeId,
              hotelId: mockHotelId,
              maxOccupancy: 2,
              basePriceCents: BigInt(450000),
              currency: 'INR',
            }),
          },
          $queryRaw: jest
            .fn()
            .mockResolvedValueOnce([
              { id: 'room-101', room_number: '101', floor: 1 },
              { id: 'room-102', room_number: '102', floor: 1 },
            ])
            .mockResolvedValueOnce([
              { room_id: 'room-101' }, // room-101 has conflict, room-102 is free!
            ]),
          booking: {
            findUnique: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue(mockCreatedBooking),
          },
        };
        return callback(tx);
      });

      const result = await service.createBooking(mockCustomerId, validDto);

      expect(result).toBeDefined();
      expect(result.id).toBe(mockBookingId);
      expect(result.status).toBe(BookingStatus.PENDING);
      expect(result.totalAmount).toBe('13500.00');
      expect(result.totalAmountCents).toBe('1350000');
      expect(result.allocatedRooms.length).toBe(1);
      expect(result.allocatedRooms[0].roomNumber).toBe('102');
    });
  });

  // ===========================================================================
  // 2. Cancellation Lifecycle & Inventory Release
  // ===========================================================================
  describe('cancelBooking', () => {
    const customerUser: AuthenticatedUser = {
      id: mockCustomerId,
      email: 'customer@stayora.com',
      role: UserRole.CUSTOMER,
      firstName: 'Aarav',
      lastName: 'Sharma',
    };

    it('should throw 404 if booking is not found', async () => {
      prisma.booking.findUnique.mockResolvedValue(null);

      await expect(
        service.cancelBooking(customerUser, mockBookingId),
      ).rejects.toThrow(
        expect.objectContaining({
          code: 'BOOKING_NOT_FOUND',
          status: 404,
        }),
      );
    });

    it('should throw 404 for IDOR attempt if customer does not own booking', async () => {
      prisma.booking.findUnique.mockResolvedValue({
        id: mockBookingId,
        customerId: 'different-customer-id',
        hotelId: mockHotelId,
        status: BookingStatus.CONFIRMED,
      });

      await expect(
        service.cancelBooking(customerUser, mockBookingId),
      ).rejects.toThrow(
        expect.objectContaining({
          code: 'BOOKING_NOT_FOUND',
          status: 404,
        }),
      );
    });

    it('should throw 400 if booking is already cancelled', async () => {
      prisma.booking.findUnique.mockResolvedValue({
        id: mockBookingId,
        customerId: mockCustomerId,
        hotelId: mockHotelId,
        status: BookingStatus.CANCELLED,
      });

      await expect(
        service.cancelBooking(customerUser, mockBookingId),
      ).rejects.toThrow(
        expect.objectContaining({
          code: 'BOOKING_ALREADY_CANCELLED',
          status: 400,
        }),
      );
    });

    it('should throw 400 if booking is checked out or completed', async () => {
      prisma.booking.findUnique.mockResolvedValue({
        id: mockBookingId,
        customerId: mockCustomerId,
        hotelId: mockHotelId,
        status: BookingStatus.CHECKED_OUT,
      });

      await expect(
        service.cancelBooking(customerUser, mockBookingId),
      ).rejects.toThrow(
        expect.objectContaining({
          code: 'INVALID_STATE_TRANSITION',
          status: 400,
        }),
      );
    });

    it('should successfully cancel booking and release allocated rooms in transaction', async () => {
      prisma.booking.findUnique.mockResolvedValue({
        id: mockBookingId,
        customerId: mockCustomerId,
        hotelId: mockHotelId,
        status: BookingStatus.CONFIRMED,
      });

      const updatedBooking = {
        id: mockBookingId,
        bookingReference: 'STY-202610-A1B2C3',
        status: BookingStatus.CANCELLED,
        checkInDate: new Date('2026-10-20'),
        checkOutDate: new Date('2026-10-23'),
        totalNights: 3,
        totalGuests: 2,
        totalAmountCents: BigInt(1350000),
        currency: 'INR',
        holdExpiresAt: null,
        cancellationReason: 'Travel plans cancelled',
        cancelledAt: new Date(),
        checkedInAt: null,
        checkedOutAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        hotel: { id: mockHotelId, name: 'Stayora Grand Palace', slug: 'palace', city: 'Mumbai' },
        bookingRooms: [
          {
            roomId: 'room-101',
            roomTypeId: mockRoomTypeId,
            room: { id: 'room-101', roomNumber: '101', floor: 1 },
            roomType: { id: mockRoomTypeId, name: 'Deluxe', slug: 'deluxe' },
          },
        ],
        priceSnapshot: null,
      };

      prisma.$transaction.mockImplementation(async (callback: any) => {
        const tx = {
          booking: { update: jest.fn().mockResolvedValue(updatedBooking) },
          bookingRoom: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
        };
        return callback(tx);
      });

      const res = await service.cancelBooking(customerUser, mockBookingId, {
        reason: 'Travel plans cancelled',
      });

      expect(res.status).toBe(BookingStatus.CANCELLED);
      expect(res.cancellationReason).toBe('Travel plans cancelled');
    });
  });

  // ===========================================================================
  // 3. State Machine Transitions
  // ===========================================================================
  describe('updateBookingStatus', () => {
    const managerUser: AuthenticatedUser = {
      id: mockManagerId,
      email: 'manager@stayora.com',
      role: UserRole.HOTEL_MANAGER,
      firstName: 'Vikram',
      lastName: 'Malhotra',
    };

    it('should reject invalid transition (CANCELLED -> CONFIRMED)', async () => {
      prisma.booking.findUnique.mockResolvedValue({
        id: mockBookingId,
        hotelId: mockHotelId,
        status: BookingStatus.CANCELLED,
      });

      await expect(
        service.updateBookingStatus(
          managerUser,
          mockBookingId,
          BookingStatus.CONFIRMED,
        ),
      ).rejects.toThrow(
        expect.objectContaining({
          code: 'INVALID_STATE_TRANSITION',
          status: 400,
        }),
      );
    });

    it('should reject invalid transition (PENDING -> CHECKED_IN)', async () => {
      prisma.booking.findUnique.mockResolvedValue({
        id: mockBookingId,
        hotelId: mockHotelId,
        status: BookingStatus.PENDING,
      });

      await expect(
        service.updateBookingStatus(
          managerUser,
          mockBookingId,
          BookingStatus.CHECKED_IN,
        ),
      ).rejects.toThrow(
        expect.objectContaining({
          code: 'INVALID_STATE_TRANSITION',
          status: 400,
        }),
      );
    });

    it('should allow valid transition (CONFIRMED -> CHECKED_IN) and mark rooms OCCUPIED', async () => {
      prisma.booking.findUnique.mockResolvedValue({
        id: mockBookingId,
        hotelId: mockHotelId,
        status: BookingStatus.CONFIRMED,
      });

      const updatedBooking = {
        id: mockBookingId,
        bookingReference: 'STY-202610-A1B2C3',
        status: BookingStatus.CHECKED_IN,
        checkInDate: new Date('2026-10-20'),
        checkOutDate: new Date('2026-10-23'),
        totalNights: 3,
        totalGuests: 2,
        totalAmountCents: BigInt(1350000),
        currency: 'INR',
        holdExpiresAt: null,
        cancellationReason: null,
        cancelledAt: null,
        checkedInAt: new Date(),
        checkedOutAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        hotel: { id: mockHotelId, name: 'Stayora Grand Palace', slug: 'palace', city: 'Mumbai' },
        bookingRooms: [
          {
            roomId: 'room-101',
            roomTypeId: mockRoomTypeId,
            room: { id: 'room-101', roomNumber: '101', floor: 1 },
            roomType: { id: mockRoomTypeId, name: 'Deluxe', slug: 'deluxe' },
          },
        ],
        priceSnapshot: null,
      };

      prisma.$transaction.mockImplementation(async (callback: any) => {
        const tx = {
          booking: { update: jest.fn().mockResolvedValue(updatedBooking) },
          bookingRoom: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
        };
        return callback(tx);
      });

      const res = await service.updateBookingStatus(
        managerUser,
        mockBookingId,
        BookingStatus.CHECKED_IN,
      );

      expect(res.status).toBe(BookingStatus.CHECKED_IN);
      expect(res.checkedInAt).toBeDefined();
    });
  });
});
