import { Injectable, HttpStatus, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DomainException } from '../../common/exceptions/domain.exception';
import { HotelAuthorizationService } from '../hotels/authorization/hotel-authorization.service';
import { AvailabilityService } from '../availability/availability.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { QueryBookingsDto } from './dto/query-bookings.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { BookingStatus, BookingRoomStatus } from './types/booking-status.enum';
import {
  BookingResponse,
  PaginatedBookingsResponse,
} from './types/booking-response.type';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { UserRole } from '../auth/types/user-role.enum';
import crypto from 'crypto';

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly hotelAuthorizationService: HotelAuthorizationService,
    private readonly availabilityService: AvailabilityService,
  ) {}

  /**
   * Authoritative Transactional Booking Creation.
   * Performs calendar validation, domain relationship checks, pessimistic row-level locking
   * on candidate operational rooms, active allocation conflict checks, and atomic insertion
   * of Booking, BookingRoom, and BookingPriceSnapshot records.
   */
  async createBooking(
    customerId: string,
    dto: CreateBookingDto,
  ): Promise<BookingResponse> {
    // 1. Date Validation using Phase 7 calendar rules
    const { checkInDate, checkOutDate, nights } =
      this.availabilityService.validateDateRange(dto.checkIn, dto.checkOut, false);

    const roomsRequested = dto.rooms || 1;

    try {
      const booking = await this.prisma.$transaction(
        async (tx) => {
          // 2. Validate Hotel exists and is active
          const hotel = await tx.hotel.findFirst({
            where: {
              id: dto.hotelId,
              isActive: true,
              deletedAt: null,
            },
            select: {
              id: true,
              name: true,
              slug: true,
              city: true,
            },
          });

          if (!hotel) {
            throw new DomainException(
              'HOTEL_NOT_FOUND',
              'Hotel property not found or is currently inactive.',
              HttpStatus.NOT_FOUND,
            );
          }

          // 3. Validate RoomType exists and is active
          const roomType = await tx.roomType.findFirst({
            where: {
              id: dto.roomTypeId,
              isActive: true,
              deletedAt: null,
            },
          });

          if (!roomType) {
            throw new DomainException(
              'ROOM_TYPE_NOT_FOUND',
              'Room category not found or is currently inactive.',
              HttpStatus.NOT_FOUND,
            );
          }

          // 4. Enforce that RoomType belongs to the target hotel
          if (roomType.hotelId !== dto.hotelId) {
            throw new DomainException(
              'HOTEL_ROOM_TYPE_MISMATCH',
              'The specified room category does not belong to the requested hotel property.',
              HttpStatus.BAD_REQUEST,
            );
          }

          // 5. Enforce guest capacity
          if (roomType.maxOccupancy < dto.guests) {
            throw new DomainException(
              'CAPACITY_EXCEEDED',
              `The selected room category (capacity: ${roomType.maxOccupancy}) cannot accommodate ${dto.guests} guests.`,
              HttpStatus.BAD_REQUEST,
            );
          }

          // 6. Pessimistically lock candidate operational physical rooms in deterministic order
          // Only rooms with operationalStatus = 'AVAILABLE' are eligible.
          // MAINTENANCE and OUT_OF_SERVICE rooms are automatically excluded.
          const candidateRooms = await tx.$queryRaw<
            Array<{ id: string; room_number: string; floor: number }>
          >`
            SELECT id, room_number, floor
            FROM rooms
            WHERE room_type_id = ${dto.roomTypeId}::uuid
              AND deleted_at IS NULL
              AND operational_status = 'AVAILABLE'
            ORDER BY room_number ASC
            FOR UPDATE;
          `;

          if (!candidateRooms || candidateRooms.length < roomsRequested) {
            throw new DomainException(
              'ROOM_NOT_AVAILABLE',
              'The selected room category does not have enough operational rooms to fulfill this reservation.',
              HttpStatus.CONFLICT,
            );
          }

          const candidateRoomIds = candidateRooms.map((r) => r.id);

          // 7. Re-check conflicting active allocations overlapping [checkIn, checkOut)
          // Overlap formula: existing.checkIn < requested.checkOut AND existing.checkOut > requested.checkIn
          const conflictingAllocations = await tx.$queryRaw<
            Array<{ room_id: string }>
          >`
            SELECT br.room_id
            FROM booking_rooms br
            JOIN bookings b ON b.id = br.booking_id
            WHERE br.room_id = ANY(${candidateRoomIds}::uuid[])
              AND br.status IN ('RESERVED', 'OCCUPIED')
              AND br.check_in_date < ${checkOutDate}::date
              AND br.check_out_date > ${checkInDate}::date
              AND b.status IN ('PENDING', 'CONFIRMED', 'CHECKED_IN')
              AND (b.hold_expires_at IS NULL OR b.hold_expires_at > NOW());
          `;

          const conflictingRoomIdSet = new Set(
            conflictingAllocations.map((a) => a.room_id),
          );

          const dateAvailableRooms = candidateRooms.filter(
            (room) => !conflictingRoomIdSet.has(room.id),
          );

          if (dateAvailableRooms.length < roomsRequested) {
            throw new DomainException(
              'ROOM_NOT_AVAILABLE',
              'The selected room category is no longer available for the requested dates.',
              HttpStatus.CONFLICT,
            );
          }

          // 8. Select required number of physical rooms
          const selectedRooms = dateAvailableRooms.slice(0, roomsRequested);

          // 9. Exact monetary calculations using integer cents (BigInt)
          const baseRateCents = roomType.basePriceCents;
          const grossRoomCents =
            baseRateCents * BigInt(nights) * BigInt(roomsRequested);
          const taxCents = BigInt(0);
          const netAmountCents = grossRoomCents + taxCents;
          const currency = roomType.currency || 'INR';

          // 10. Generate unique booking reference
          const bookingReference = await this.generateUniqueBookingReference(tx);

          // 11. Create Booking with nested BookingRoom and BookingPriceSnapshot
          const createdBooking = await tx.booking.create({
            data: {
              bookingReference,
              customerId,
              hotelId: dto.hotelId,
              status: BookingStatus.PENDING,
              checkInDate,
              checkOutDate,
              totalNights: nights,
              totalGuests: dto.guests,
              totalAmountCents: netAmountCents,
              currency,
              holdExpiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15-minute temporary inventory hold
              bookingRooms: {
                create: selectedRooms.map((room) => ({
                  roomId: room.id,
                  roomTypeId: dto.roomTypeId,
                  checkInDate,
                  checkOutDate,
                  status: BookingRoomStatus.RESERVED,
                })),
              },
              priceSnapshot: {
                create: {
                  baseRateCents,
                  totalNights: nights,
                  grossRoomCents,
                  taxCents: BigInt(0),
                  serviceFeeCents: BigInt(0),
                  discountCents: BigInt(0),
                  netAmountCents,
                  currency,
                },
              },
            },
            include: {
              hotel: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  city: true,
                },
              },
              bookingRooms: {
                include: {
                  room: {
                    select: {
                      id: true,
                      roomNumber: true,
                      floor: true,
                    },
                  },
                  roomType: {
                    select: {
                      id: true,
                      name: true,
                      slug: true,
                    },
                  },
                },
              },
              priceSnapshot: true,
            },
          });

          return createdBooking;
        },
        { timeout: 15000, maxWait: 10000 },
      );

      return this.mapToBookingResponse(booking);
    } catch (error: any) {
      if (error instanceof DomainException) {
        throw error;
      }

      // Catch PostgreSQL GiST exclusion constraint error (23P01) or Prisma error (P2010/P2002)
      if (
        error.code === '23P01' ||
        error.code === 'P2010' ||
        error.message?.includes('exclude_overlapping_room_allocations') ||
        error.message?.includes('exclusion')
      ) {
        this.logger.warn(
          `Concurrent double-booking intercepted by GiST exclusion constraint for RoomType ${dto.roomTypeId}`,
        );
        throw new DomainException(
          'ROOM_NOT_AVAILABLE',
          'The selected room category is no longer available for the requested dates.',
          HttpStatus.CONFLICT,
        );
      }

      this.logger.error(`Error in createBooking: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * List bookings for the authenticated customer.
   */
  async findCustomerBookings(
    customerId: string,
    query: QueryBookingsDto,
  ): Promise<PaginatedBookingsResponse> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {
      customerId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.hotelId ? { hotelId: query.hotelId } : {}),
    };

    const [total, bookings] = await Promise.all([
      this.prisma.booking.count({ where }),
      this.prisma.booking.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          hotel: {
            select: { id: true, name: true, slug: true, city: true },
          },
          bookingRooms: {
            include: {
              room: { select: { id: true, roomNumber: true, floor: true } },
              roomType: { select: { id: true, name: true, slug: true } },
            },
          },
          priceSnapshot: true,
        },
      }),
    ]);

    return {
      items: bookings.map((b) => this.mapToBookingResponse(b)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * List bookings scoped to hotels assigned to the authenticated manager.
   */
  async findManagerBookings(
    managerId: string,
    query: QueryBookingsDto,
  ): Promise<PaginatedBookingsResponse> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    let targetHotelIds: string[];

    if (query.hotelId) {
      await this.hotelAuthorizationService.assertManagerAccess(
        managerId,
        query.hotelId,
      );
      targetHotelIds = [query.hotelId];
    } else {
      targetHotelIds =
        await this.hotelAuthorizationService.getManagedHotelIds(managerId);
    }

    if (targetHotelIds.length === 0) {
      return {
        items: [],
        meta: { page, limit, total: 0, totalPages: 1 },
      };
    }

    const where: any = {
      hotelId: { in: targetHotelIds },
      ...(query.status ? { status: query.status } : {}),
    };

    const [total, bookings] = await Promise.all([
      this.prisma.booking.count({ where }),
      this.prisma.booking.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          hotel: {
            select: { id: true, name: true, slug: true, city: true },
          },
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
          bookingRooms: {
            include: {
              room: { select: { id: true, roomNumber: true, floor: true } },
              roomType: { select: { id: true, name: true, slug: true } },
            },
          },
          priceSnapshot: true,
        },
      }),
    ]);

    return {
      items: bookings.map((b) => this.mapToBookingResponse(b)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Platform-wide booking discovery for Administrators.
   */
  async findAllBookings(
    query: QueryBookingsDto,
  ): Promise<PaginatedBookingsResponse> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.hotelId ? { hotelId: query.hotelId } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
    };

    const [total, bookings] = await Promise.all([
      this.prisma.booking.count({ where }),
      this.prisma.booking.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          hotel: {
            select: { id: true, name: true, slug: true, city: true },
          },
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
          bookingRooms: {
            include: {
              room: { select: { id: true, roomNumber: true, floor: true } },
              roomType: { select: { id: true, name: true, slug: true } },
            },
          },
          priceSnapshot: true,
        },
      }),
    ]);

    return {
      items: bookings.map((b) => this.mapToBookingResponse(b)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Retrieve a single booking with resource-level authorization checks.
   */
  async findBookingById(
    user: AuthenticatedUser,
    bookingId: string,
  ): Promise<BookingResponse> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        hotel: {
          select: { id: true, name: true, slug: true, city: true },
        },
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        bookingRooms: {
          include: {
            room: { select: { id: true, roomNumber: true, floor: true } },
            roomType: { select: { id: true, name: true, slug: true } },
          },
        },
        priceSnapshot: true,
      },
    });

    if (!booking) {
      throw new DomainException(
        'BOOKING_NOT_FOUND',
        'Reservation record not found.',
        HttpStatus.NOT_FOUND,
      );
    }

    // Role-based authorization
    if (user.role === UserRole.CUSTOMER) {
      if (booking.customerId !== user.id) {
        // Return 404 to prevent resource existence disclosure (IDOR defense)
        throw new DomainException(
          'BOOKING_NOT_FOUND',
          'Reservation record not found.',
          HttpStatus.NOT_FOUND,
        );
      }
    } else if (
      user.role === UserRole.HOTEL_MANAGER ||
      user.role === 'MANAGER'
    ) {
      await this.hotelAuthorizationService.assertManagerAccess(
        user.id,
        booking.hotelId,
        { hideExistence: true },
      );
    } else if (user.role !== UserRole.ADMIN) {
      throw new DomainException(
        'FORBIDDEN',
        'You do not have permission to view this reservation.',
        HttpStatus.FORBIDDEN,
      );
    }

    return this.mapToBookingResponse(booking);
  }

  /**
   * Cancel a reservation with state validation and atomic inventory release.
   */
  async cancelBooking(
    user: AuthenticatedUser,
    bookingId: string,
    dto?: CancelBookingDto,
  ): Promise<BookingResponse> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new DomainException(
        'BOOKING_NOT_FOUND',
        'Reservation record not found.',
        HttpStatus.NOT_FOUND,
      );
    }

    // Authorization
    if (user.role === UserRole.CUSTOMER) {
      if (booking.customerId !== user.id) {
        throw new DomainException(
          'BOOKING_NOT_FOUND',
          'Reservation record not found.',
          HttpStatus.NOT_FOUND,
        );
      }
    } else if (
      user.role === UserRole.HOTEL_MANAGER ||
      user.role === 'MANAGER'
    ) {
      await this.hotelAuthorizationService.assertManagerAccess(
        user.id,
        booking.hotelId,
        { hideExistence: true },
      );
    }

    // State machine check: cannot cancel already terminal states
    if (booking.status === BookingStatus.CANCELLED) {
      throw new DomainException(
        'BOOKING_ALREADY_CANCELLED',
        'This reservation is already cancelled.',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (
      booking.status === BookingStatus.CHECKED_OUT ||
      booking.status === BookingStatus.EXPIRED ||
      booking.status === BookingStatus.NO_SHOW
    ) {
      throw new DomainException(
        'INVALID_STATE_TRANSITION',
        `Completed or expired bookings cannot be cancelled (current status: ${booking.status}).`,
        HttpStatus.BAD_REQUEST,
      );
    }

    // Transactional status update and inventory release
    const updatedBooking = await this.prisma.$transaction(async (tx) => {
      // 1. Mark booking CANCELLED
      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: BookingStatus.CANCELLED,
          cancelledAt: new Date(),
          cancellationReason: dto?.reason || 'Cancelled by user',
        },
        include: {
          hotel: {
            select: { id: true, name: true, slug: true, city: true },
          },
          bookingRooms: {
            include: {
              room: { select: { id: true, roomNumber: true, floor: true } },
              roomType: { select: { id: true, name: true, slug: true } },
            },
          },
          priceSnapshot: true,
        },
      });

      // 2. Release allocated rooms in booking_rooms
      await tx.bookingRoom.updateMany({
        where: { bookingId },
        data: { status: BookingRoomStatus.CANCELLED },
      });

      return updated;
    });

    return this.mapToBookingResponse(updatedBooking);
  }

  /**
   * Update booking lifecycle state (HOTEL_MANAGER or ADMIN).
   * Enforces the domain state machine.
   */
  async updateBookingStatus(
    user: AuthenticatedUser,
    bookingId: string,
    targetStatus: BookingStatus,
  ): Promise<BookingResponse> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new DomainException(
        'BOOKING_NOT_FOUND',
        'Reservation record not found.',
        HttpStatus.NOT_FOUND,
      );
    }

    // Authorization
    if (
      user.role === UserRole.HOTEL_MANAGER ||
      user.role === 'MANAGER'
    ) {
      await this.hotelAuthorizationService.assertManagerAccess(
        user.id,
        booking.hotelId,
        { hideExistence: true },
      );
    } else if (user.role !== UserRole.ADMIN) {
      throw new DomainException(
        'FORBIDDEN',
        'You do not have permission to update reservation lifecycle status.',
        HttpStatus.FORBIDDEN,
      );
    }

    // State machine transition validation
    const currentStatus = booking.status as BookingStatus;
    const allowedTransitions: Record<BookingStatus, BookingStatus[]> = {
      [BookingStatus.PENDING]: [
        BookingStatus.CONFIRMED,
        BookingStatus.CANCELLED,
        BookingStatus.EXPIRED,
      ],
      [BookingStatus.CONFIRMED]: [
        BookingStatus.CHECKED_IN,
        BookingStatus.CANCELLED,
        BookingStatus.NO_SHOW,
      ],
      [BookingStatus.CHECKED_IN]: [BookingStatus.CHECKED_OUT],
      [BookingStatus.CHECKED_OUT]: [],
      [BookingStatus.CANCELLED]: [],
      [BookingStatus.EXPIRED]: [],
      [BookingStatus.NO_SHOW]: [],
    };

    const validTargets = allowedTransitions[currentStatus] || [];
    if (!validTargets.includes(targetStatus)) {
      throw new DomainException(
        'INVALID_STATE_TRANSITION',
        `Cannot transition reservation from ${currentStatus} to ${targetStatus}.`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const updatedBooking = await this.prisma.$transaction(async (tx) => {
      const updateData: any = { status: targetStatus };

      if (targetStatus === BookingStatus.CHECKED_IN) {
        updateData.checkedInAt = new Date();
      } else if (targetStatus === BookingStatus.CHECKED_OUT) {
        updateData.checkedOutAt = new Date();
      } else if (targetStatus === BookingStatus.CANCELLED) {
        updateData.cancelledAt = new Date();
      }

      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: updateData,
        include: {
          hotel: {
            select: { id: true, name: true, slug: true, city: true },
          },
          bookingRooms: {
            include: {
              room: { select: { id: true, roomNumber: true, floor: true } },
              roomType: { select: { id: true, name: true, slug: true } },
            },
          },
          priceSnapshot: true,
        },
      });

      // Synchronize booking_rooms allocation status
      let roomAllocationStatus: BookingRoomStatus | null = null;
      if (targetStatus === BookingStatus.CHECKED_IN) {
        roomAllocationStatus = BookingRoomStatus.OCCUPIED;
      } else if (targetStatus === BookingStatus.CHECKED_OUT) {
        roomAllocationStatus = BookingRoomStatus.RELEASED;
      } else if (
        targetStatus === BookingStatus.CANCELLED ||
        targetStatus === BookingStatus.EXPIRED
      ) {
        roomAllocationStatus = BookingRoomStatus.CANCELLED;
      }

      if (roomAllocationStatus) {
        await tx.bookingRoom.updateMany({
          where: { bookingId },
          data: { status: roomAllocationStatus },
        });
      }

      return updated;
    });

    return this.mapToBookingResponse(updatedBooking);
  }

  /**
   * Helper to map raw Prisma booking records to client-safe BookingResponse DTOs.
   */
  private mapToBookingResponse(booking: any): BookingResponse {
    const firstRoomType = booking.bookingRooms?.[0]?.roomType;
    const allocatedRooms = (booking.bookingRooms || []).map((br: any) => ({
      id: br.room?.id || br.roomId,
      roomNumber: br.room?.roomNumber || 'Unknown',
      floor: br.room?.floor || 0,
    }));

    let priceSnapshot: any = undefined;
    if (booking.priceSnapshot) {
      const ps = booking.priceSnapshot;
      priceSnapshot = {
        baseRate: (Number(ps.baseRateCents) / 100).toFixed(2),
        baseRateCents: ps.baseRateCents.toString(),
        totalNights: ps.totalNights,
        grossAmount: (Number(ps.grossRoomCents) / 100).toFixed(2),
        grossRoomCents: ps.grossRoomCents.toString(),
        taxAmount: (Number(ps.taxCents) / 100).toFixed(2),
        taxCents: ps.taxCents.toString(),
        serviceFeeAmount: (Number(ps.serviceFeeCents) / 100).toFixed(2),
        serviceFeeCents: ps.serviceFeeCents.toString(),
        discountAmount: (Number(ps.discountCents) / 100).toFixed(2),
        discountCents: ps.discountCents.toString(),
        netAmount: (Number(ps.netAmountCents) / 100).toFixed(2),
        netAmountCents: ps.netAmountCents.toString(),
        currency: ps.currency,
      };
    }

    return {
      id: booking.id,
      bookingReference: booking.bookingReference,
      status: booking.status,
      checkIn: booking.checkInDate.toISOString().split('T')[0],
      checkOut: booking.checkOutDate.toISOString().split('T')[0],
      totalNights: booking.totalNights,
      totalGuests: booking.totalGuests,
      roomsCount: booking.bookingRooms?.length || 1,
      totalAmount: (Number(booking.totalAmountCents) / 100).toFixed(2),
      totalAmountCents: booking.totalAmountCents.toString(),
      currency: booking.currency,
      holdExpiresAt: booking.holdExpiresAt
        ? booking.holdExpiresAt.toISOString()
        : null,
      cancellationReason: booking.cancellationReason,
      cancelledAt: booking.cancelledAt
        ? booking.cancelledAt.toISOString()
        : null,
      checkedInAt: booking.checkedInAt
        ? booking.checkedInAt.toISOString()
        : null,
      checkedOutAt: booking.checkedOutAt
        ? booking.checkedOutAt.toISOString()
        : null,
      createdAt: booking.createdAt.toISOString(),
      updatedAt: booking.updatedAt.toISOString(),
      hotel: {
        id: booking.hotel.id,
        name: booking.hotel.name,
        slug: booking.hotel.slug,
        city: booking.hotel.city,
      },
      roomType: {
        id: firstRoomType?.id || booking.bookingRooms?.[0]?.roomTypeId,
        name: firstRoomType?.name || 'Standard Room',
        slug: firstRoomType?.slug || 'standard-room',
      },
      allocatedRooms,
      priceSnapshot,
      ...(booking.customer
        ? {
            customer: {
              id: booking.customer.id,
              firstName: booking.customer.firstName,
              lastName: booking.customer.lastName,
              email: booking.customer.email,
              phone: booking.customer.phone,
            },
          }
        : {}),
    };
  }

  /**
   * Generate an authoritative unique booking reference: STY-YYYYMM-XXXXXX (17 characters).
   */
  private async generateUniqueBookingReference(tx: any): Promise<string> {
    const yearMonth = new Date().toISOString().slice(0, 7).replace('-', '');
    for (let attempt = 0; attempt < 5; attempt++) {
      const randomPart = crypto.randomBytes(3).toString('hex').toUpperCase();
      const reference = `STY-${yearMonth}-${randomPart}`;
      const existing = await tx.booking.findUnique({
        where: { bookingReference: reference },
        select: { id: true },
      });
      if (!existing) {
        return reference;
      }
    }
    // Fallback using timestamp
    const timestampPart = Date.now().toString().slice(-6);
    return `STY-${yearMonth}-${timestampPart}`;
  }
}
