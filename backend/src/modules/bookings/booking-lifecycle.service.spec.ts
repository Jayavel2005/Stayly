import { Test, TestingModule } from '@nestjs/testing';
import { BookingLifecycleService } from './booking-lifecycle.service';
import { PrismaService } from '../../prisma/prisma.service';
import { HotelAuthorizationService } from '../hotels/authorization/hotel-authorization.service';
import { DomainException } from '../../common/exceptions/domain.exception';
import { BookingStatus, BookingRoomStatus } from './types/booking-status.enum';
import { UserRole } from '../auth/types/user-role.enum';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { NotificationsService } from '../notifications/notifications.service';

describe('BookingLifecycleService Unit Tests', () => {
  let service: BookingLifecycleService;
  let prisma: any;
  let hotelAuthService: any;

  const mockHotelId = '44444444-4444-4444-8444-444444444444';
  const mockRoomTypeId = '57391b9b-ed2d-4e3d-bb09-63728b53254f';
  const customerAId = '11111111-1111-4111-8111-111111111111';
  const customerBId = '22222222-2222-4222-8222-222222222222';
  const managerId = '33333333-3333-4333-8333-333333333333';
  const adminId = '44444444-4444-4444-8444-444444444444';
  const bookingId = '99999999-9999-4999-8999-999999999999';

  const customerA: AuthenticatedUser = {
    id: customerAId,
    email: 'customer.a@stayora.com',
    role: UserRole.CUSTOMER,
    firstName: 'Aarav',
    lastName: 'Sharma',
  };

  const customerB: AuthenticatedUser = {
    id: customerBId,
    email: 'customer.b@stayora.com',
    role: UserRole.CUSTOMER,
    firstName: 'Bhavna',
    lastName: 'Patel',
  };

  const manager: AuthenticatedUser = {
    id: managerId,
    email: 'manager@stayora.com',
    role: UserRole.HOTEL_MANAGER,
    firstName: 'Vikram',
    lastName: 'Malhotra',
  };

  const admin: AuthenticatedUser = {
    id: adminId,
    email: 'admin@stayora.com',
    role: UserRole.ADMIN,
    firstName: 'Admin',
    lastName: 'Stayora',
  };

  const createBaseBooking = (status: BookingStatus = BookingStatus.CONFIRMED) => ({
    id: bookingId,
    customerId: customerAId,
    hotelId: mockHotelId,
    bookingReference: 'STY-202610-A1B2C3',
    status,
    checkInDate: new Date('2026-10-20T00:00:00.000Z'),
    checkOutDate: new Date('2026-10-23T00:00:00.000Z'),
    totalNights: 3,
    totalGuests: 2,
    totalAmountCents: BigInt(1350000),
    currency: 'INR',
    holdExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
    cancellationReason: null,
    cancelledAt: null,
    checkedInAt: null,
    checkedOutAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    hotel: { id: mockHotelId, name: 'Stayora Grand Palace', slug: 'palace', city: 'Mumbai' },
    bookingRooms: [
      {
        id: 'br-1',
        roomId: 'room-101',
        roomTypeId: mockRoomTypeId,
        status: BookingRoomStatus.RESERVED,
        room: { id: 'room-101', roomNumber: '101', floor: 1 },
        roomType: { id: mockRoomTypeId, name: 'Deluxe Suite', slug: 'deluxe-suite' },
      },
    ],
    priceSnapshot: null,
    customer: { id: customerAId, firstName: 'Aarav', lastName: 'Sharma', email: 'customer.a@stayora.com', phone: '9876543210' },
  });

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn(async (cb) => {
        const tx = {
          $queryRaw: jest.fn().mockResolvedValue([{ id: bookingId, status: BookingStatus.CONFIRMED }]),
          booking: {
            update: jest.fn().mockImplementation(({ data }) => ({
              ...createBaseBooking(),
              ...data,
            })),
          },
          bookingRoom: {
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
          auditLog: {
            create: jest.fn().mockResolvedValue({}),
          },
        };
        return cb(tx);
      }),
      $queryRaw: jest.fn().mockResolvedValue([{ id: bookingId, status: BookingStatus.CONFIRMED }]),
      booking: {
        findUnique: jest.fn().mockResolvedValue(createBaseBooking()),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue(createBaseBooking()),
      },
      bookingRoom: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
      },
    };

    hotelAuthService = {
      assertManagerAccess: jest.fn().mockResolvedValue(undefined),
    };

    const notificationsService = {
      create: jest.fn().mockResolvedValue({ id: 'mock-notif-id' }),
      createForManagersOfHotel: jest.fn().mockResolvedValue(1),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingLifecycleService,
        { provide: PrismaService, useValue: prisma },
        { provide: HotelAuthorizationService, useValue: hotelAuthService },
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    service = module.get<BookingLifecycleService>(BookingLifecycleService);
  });

  // ===========================================================================
  // 1. Authoritative State Machine Matrix
  // ===========================================================================
  describe('Central State Machine Matrix', () => {
    it('should validate all permitted transitions', () => {
      // PENDING
      expect(service.canTransition(BookingStatus.PENDING, BookingStatus.CONFIRMED)).toBe(true);
      expect(service.canTransition(BookingStatus.PENDING, BookingStatus.CANCELLED)).toBe(true);
      expect(service.canTransition(BookingStatus.PENDING, BookingStatus.EXPIRED)).toBe(true);

      // CONFIRMED
      expect(service.canTransition(BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN)).toBe(true);
      expect(service.canTransition(BookingStatus.CONFIRMED, BookingStatus.CANCELLED)).toBe(true);
      expect(service.canTransition(BookingStatus.CONFIRMED, BookingStatus.NO_SHOW)).toBe(true);

      // CHECKED_IN
      expect(service.canTransition(BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT)).toBe(true);
    });

    it('should reject all invalid state transitions', () => {
      // Completed / Checked-out is terminal
      expect(service.canTransition(BookingStatus.CHECKED_OUT, BookingStatus.CONFIRMED)).toBe(false);
      expect(service.canTransition(BookingStatus.CHECKED_OUT, BookingStatus.CANCELLED)).toBe(false);
      expect(service.canTransition(BookingStatus.CHECKED_OUT, BookingStatus.CHECKED_IN)).toBe(false);

      // Cancelled is terminal
      expect(service.canTransition(BookingStatus.CANCELLED, BookingStatus.CONFIRMED)).toBe(false);
      expect(service.canTransition(BookingStatus.CANCELLED, BookingStatus.CHECKED_IN)).toBe(false);
      expect(service.canTransition(BookingStatus.CANCELLED, BookingStatus.CANCELLED)).toBe(false);

      // Expired is terminal
      expect(service.canTransition(BookingStatus.EXPIRED, BookingStatus.CONFIRMED)).toBe(false);
      expect(service.canTransition(BookingStatus.EXPIRED, BookingStatus.CHECKED_IN)).toBe(false);

      // Skipping steps is disallowed
      expect(service.canTransition(BookingStatus.PENDING, BookingStatus.CHECKED_IN)).toBe(false);
      expect(service.canTransition(BookingStatus.PENDING, BookingStatus.CHECKED_OUT)).toBe(false);
      expect(service.canTransition(BookingStatus.CONFIRMED, BookingStatus.CHECKED_OUT)).toBe(false);
    });

    it('assertValidTransition should throw DomainException with 400 for invalid transitions', () => {
      expect(() =>
        service.assertValidTransition(BookingStatus.CHECKED_OUT, BookingStatus.CONFIRMED),
      ).toThrow(
        expect.objectContaining({
          code: 'INVALID_STATE_TRANSITION',
          status: 400,
        }),
      );
    });
  });

  // ===========================================================================
  // 2. Customer Cancellation
  // ===========================================================================
  describe('cancelBooking', () => {
    it('customer should successfully cancel their own CONFIRMED reservation', async () => {
      const res = await service.cancelBooking(customerA, bookingId, 'Change of itinerary');

      expect(res.status).toBe(BookingStatus.CANCELLED);
      expect(res.cancellationReason).toBe('Change of itinerary');
      expect(res.cancelledAt).toBeDefined();
      expect(res.message).toBe('Booking cancelled successfully.');
    });

    it('customer should be rejected when attempting to cancel another customer booking (IDOR defense 404)', async () => {
      await expect(
        service.cancelBooking(customerB, bookingId),
      ).rejects.toThrow(
        expect.objectContaining({
          code: 'BOOKING_NOT_FOUND',
          status: 404,
        }),
      );
    });

    it('manager should be able to cancel booking for assigned hotel', async () => {
      const res = await service.cancelBooking(manager, bookingId, 'Operational rebooking');

      expect(res.status).toBe(BookingStatus.CANCELLED);
      expect(hotelAuthService.assertManagerAccess).toHaveBeenCalledWith(
        manager.id,
        mockHotelId,
        { hideExistence: true },
      );
    });

    it('manager should be rejected if not assigned to the hotel', async () => {
      hotelAuthService.assertManagerAccess.mockRejectedValueOnce(
        new DomainException('NOT_FOUND', 'Hotel property not found.', 404),
      );

      await expect(
        service.cancelBooking(manager, bookingId),
      ).rejects.toThrow(
        expect.objectContaining({ code: 'NOT_FOUND', status: 404 }),
      );
    });

    it('should reject cancelling an already cancelled booking (400)', async () => {
      prisma.booking.findUnique.mockResolvedValueOnce(
        createBaseBooking(BookingStatus.CANCELLED),
      );

      await expect(
        service.cancelBooking(customerA, bookingId),
      ).rejects.toThrow(
        expect.objectContaining({
          code: 'BOOKING_ALREADY_CANCELLED',
          status: 400,
        }),
      );
    });

    it('should reject cancelling a CHECKED_IN reservation (400)', async () => {
      prisma.booking.findUnique.mockResolvedValueOnce(
        createBaseBooking(BookingStatus.CHECKED_IN),
      );

      await expect(
        service.cancelBooking(customerA, bookingId),
      ).rejects.toThrow(
        expect.objectContaining({
          code: 'BOOKING_NOT_CANCELLABLE',
          status: 400,
        }),
      );
    });

    it('should reject cancelling a CHECKED_OUT reservation (400)', async () => {
      prisma.booking.findUnique.mockResolvedValueOnce(
        createBaseBooking(BookingStatus.CHECKED_OUT),
      );

      await expect(
        service.cancelBooking(customerA, bookingId),
      ).rejects.toThrow(
        expect.objectContaining({
          code: 'INVALID_STATE_TRANSITION',
          status: 400,
        }),
      );
    });

    it('should reject cancelling an EXPIRED reservation (400)', async () => {
      prisma.booking.findUnique.mockResolvedValueOnce(
        createBaseBooking(BookingStatus.EXPIRED),
      );

      await expect(
        service.cancelBooking(customerA, bookingId),
      ).rejects.toThrow(
        expect.objectContaining({
          code: 'INVALID_STATE_TRANSITION',
          status: 400,
        }),
      );
    });
  });

  // ===========================================================================
  // 3. Operational Check-In
  // ===========================================================================
  describe('checkInBooking', () => {
    it('manager should successfully check in a CONFIRMED reservation', async () => {
      prisma.$transaction.mockImplementationOnce(async (cb) => {
        const tx = {
          $queryRaw: jest.fn().mockResolvedValue([{ id: bookingId, status: BookingStatus.CONFIRMED }]),
          booking: {
            update: jest.fn().mockResolvedValue({
              ...createBaseBooking(BookingStatus.CHECKED_IN),
              checkedInAt: new Date(),
            }),
          },
          bookingRoom: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
          auditLog: { create: jest.fn().mockResolvedValue({}) },
        };
        return cb(tx);
      });

      const res = await service.checkInBooking(manager, bookingId);

      expect(res.status).toBe(BookingStatus.CHECKED_IN);
      expect(res.checkedInAt).toBeDefined();
      expect(res.message).toBe('Booking checked in successfully.');
    });

    it('should reject customer attempting check-in (403 Forbidden)', async () => {
      await expect(
        service.checkInBooking(customerA, bookingId),
      ).rejects.toThrow(
        expect.objectContaining({ code: 'FORBIDDEN', status: 403 }),
      );
    });

    it('should reject check-in if reservation is PENDING (400)', async () => {
      prisma.booking.findUnique.mockResolvedValueOnce(
        createBaseBooking(BookingStatus.PENDING),
      );

      await expect(
        service.checkInBooking(manager, bookingId),
      ).rejects.toThrow(
        expect.objectContaining({
          code: 'BOOKING_NOT_CHECKINABLE',
          status: 400,
        }),
      );
    });

    it('should reject check-in if reservation is CANCELLED (400)', async () => {
      prisma.booking.findUnique.mockResolvedValueOnce(
        createBaseBooking(BookingStatus.CANCELLED),
      );

      await expect(
        service.checkInBooking(manager, bookingId),
      ).rejects.toThrow(
        expect.objectContaining({
          code: 'BOOKING_NOT_CHECKINABLE',
          status: 400,
        }),
      );
    });

    it('should reject check-in if reservation is already CHECKED_IN (400)', async () => {
      prisma.booking.findUnique.mockResolvedValueOnce(
        createBaseBooking(BookingStatus.CHECKED_IN),
      );

      await expect(
        service.checkInBooking(manager, bookingId),
      ).rejects.toThrow(
        expect.objectContaining({
          code: 'BOOKING_ALREADY_CHECKED_IN',
          status: 400,
        }),
      );
    });

    it('should reject check-in if checkout date has already passed (400)', async () => {
      const pastBooking = createBaseBooking(BookingStatus.CONFIRMED);
      pastBooking.checkOutDate = new Date('2020-01-05T00:00:00.000Z');
      prisma.booking.findUnique.mockResolvedValueOnce(pastBooking);

      await expect(
        service.checkInBooking(manager, bookingId),
      ).rejects.toThrow(
        expect.objectContaining({
          code: 'BOOKING_NOT_CHECKINABLE',
          status: 400,
        }),
      );
    });
  });

  // ===========================================================================
  // 4. Operational Check-Out
  // ===========================================================================
  describe('checkOutBooking', () => {
    it('manager should successfully check out an active CHECKED_IN reservation', async () => {
      prisma.booking.findUnique.mockResolvedValueOnce(
        createBaseBooking(BookingStatus.CHECKED_IN),
      );

      prisma.$transaction.mockImplementationOnce(async (cb) => {
        const tx = {
          $queryRaw: jest.fn().mockResolvedValue([{ id: bookingId, status: BookingStatus.CHECKED_IN }]),
          booking: {
            update: jest.fn().mockResolvedValue({
              ...createBaseBooking(BookingStatus.CHECKED_OUT),
              checkedOutAt: new Date(),
            }),
          },
          bookingRoom: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
          auditLog: { create: jest.fn().mockResolvedValue({}) },
        };
        return cb(tx);
      });

      const res = await service.checkOutBooking(manager, bookingId);

      expect(res.status).toBe(BookingStatus.CHECKED_OUT);
      expect(res.checkedOutAt).toBeDefined();
      expect(res.message).toBe('Booking checked out successfully.');
    });

    it('should reject customer attempting check-out (403 Forbidden)', async () => {
      await expect(
        service.checkOutBooking(customerA, bookingId),
      ).rejects.toThrow(
        expect.objectContaining({ code: 'FORBIDDEN', status: 403 }),
      );
    });

    it('should reject check-out if reservation is CONFIRMED (not checked in) (400)', async () => {
      prisma.booking.findUnique.mockResolvedValueOnce(
        createBaseBooking(BookingStatus.CONFIRMED),
      );

      await expect(
        service.checkOutBooking(manager, bookingId),
      ).rejects.toThrow(
        expect.objectContaining({
          code: 'BOOKING_NOT_CHECKOUTABLE',
          status: 400,
        }),
      );
    });

    it('should reject check-out if reservation is already CHECKED_OUT (400)', async () => {
      prisma.booking.findUnique.mockResolvedValueOnce(
        createBaseBooking(BookingStatus.CHECKED_OUT),
      );

      await expect(
        service.checkOutBooking(manager, bookingId),
      ).rejects.toThrow(
        expect.objectContaining({
          code: 'BOOKING_ALREADY_COMPLETED',
          status: 400,
        }),
      );
    });
  });

  // ===========================================================================
  // 5. Reservation Expiration
  // ===========================================================================
  describe('expireBooking & expireStalePendingBookings', () => {
    it('should expire a PENDING booking whose hold elapsed', async () => {
      prisma.booking.findUnique.mockResolvedValueOnce(
        createBaseBooking(BookingStatus.PENDING),
      );

      prisma.$transaction.mockImplementationOnce(async (cb) => {
        const tx = {
          booking: {
            update: jest.fn().mockResolvedValue(
              createBaseBooking(BookingStatus.EXPIRED),
            ),
          },
          bookingRoom: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
          auditLog: { create: jest.fn().mockResolvedValue({}) },
        };
        return cb(tx);
      });

      const res = await service.expireBooking(bookingId);

      expect(res.status).toBe(BookingStatus.EXPIRED);
      expect(res.message).toBe('Booking hold expired.');
    });

    it('should reject expiring a non-PENDING reservation', async () => {
      prisma.booking.findUnique.mockResolvedValueOnce(
        createBaseBooking(BookingStatus.CONFIRMED),
      );

      await expect(service.expireBooking(bookingId)).rejects.toThrow(
        expect.objectContaining({
          code: 'INVALID_STATE_TRANSITION',
          status: 400,
        }),
      );
    });

    it('expireStalePendingBookings should find and expire stale holds', async () => {
      prisma.booking.findMany.mockResolvedValueOnce([
        { id: 'stale-1' },
        { id: 'stale-2' },
      ]);

      jest.spyOn(service, 'expireBooking').mockResolvedValue({} as any);

      const count = await service.expireStalePendingBookings();

      expect(count).toBe(2);
      expect(service.expireBooking).toHaveBeenCalledTimes(2);
    });
  });
});
