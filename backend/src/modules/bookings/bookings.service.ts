import { Injectable, HttpStatus, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DomainException } from '../../common/exceptions/domain.exception';
import { HotelAuthorizationService } from '../hotels/authorization/hotel-authorization.service';
import { AvailabilityService } from '../availability/availability.service';
import { BookingLifecycleService } from './booking-lifecycle.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/types/notification-type.enum';
import { RealtimeService } from '../../infrastructure/realtime/realtime.service';
import { RealtimeEventType } from '../../infrastructure/realtime/realtime.events';
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
    private readonly lifecycleService: BookingLifecycleService,
    private readonly notificationsService: NotificationsService,
    @Optional() private readonly realtimeService?: RealtimeService,
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

      // Dispatch Domain Notifications (non-blocking)
      try {
        await this.notificationsService.create({
          userId: customerId,
          type: NotificationType.BOOKING_CREATED,
          title: 'Booking Created',
          message: 'Your booking has been created successfully.',
          data: {
            bookingId: booking.id,
            hotelId: booking.hotelId,
            bookingReference: booking.bookingReference,
          },
        });

        await this.notificationsService.createForManagersOfHotel(booking.hotelId, {
          type: NotificationType.BOOKING_CREATED,
          title: 'New Booking Created',
          message: `A new booking (${booking.bookingReference}) has been created for your property.`,
          data: {
            bookingId: booking.id,
            hotelId: booking.hotelId,
            bookingReference: booking.bookingReference,
          },
        });
      } catch (notifErr: any) {
        this.logger.warn(
          `[BookingsService] Failed to dispatch booking created notification: ${notifErr.message}`,
        );
      }

      // Publish Realtime SSE Event (post-commit)
      try {
        if (this.realtimeService) {
          await this.realtimeService.publish(
            RealtimeEventType.BOOKING_CREATED,
            {
              bookingId: booking.id,
              bookingReference: booking.bookingReference,
              hotelId: booking.hotelId,
              customerId: booking.customerId,
              status: booking.status,
              totalAmountCents: booking.priceSnapshot
                ? Number(booking.priceSnapshot.netAmountCents)
                : undefined,
              createdAt: booking.createdAt,
            },
            {
              userId: booking.customerId,
              hotelId: booking.hotelId,
              includeAdmins: true,
            },
          );
        }
      } catch (realtimeErr: any) {
        this.logger.warn(
          `[BookingsService] Failed to publish real-time BOOKING_CREATED event: ${realtimeErr.message}`,
        );
      }

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
    return this.lifecycleService.cancelBooking(user, bookingId, dto?.reason);
  }

  /**
   * Check in a guest for a confirmed reservation (Manager or Admin).
   */
  async checkInBooking(
    user: AuthenticatedUser,
    bookingId: string,
  ): Promise<BookingResponse> {
    return this.lifecycleService.checkInBooking(user, bookingId);
  }

  /**
   * Check out a guest for a checked-in reservation (Manager or Admin).
   */
  async checkOutBooking(
    user: AuthenticatedUser,
    bookingId: string,
  ): Promise<BookingResponse> {
    return this.lifecycleService.checkOutBooking(user, bookingId);
  }

  /**
   * Update booking lifecycle state (HOTEL_MANAGER or ADMIN).
   * Enforces the centralized domain state machine.
   */
  async updateBookingStatus(
    user: AuthenticatedUser,
    bookingId: string,
    targetStatus: BookingStatus,
  ): Promise<BookingResponse> {
    return this.lifecycleService.updateBookingStatus(user, bookingId, targetStatus);
  }

  /**
   * Helper to map raw Prisma booking records to client-safe BookingResponse DTOs.
   */
  private mapToBookingResponse(booking: any): BookingResponse {
    return this.lifecycleService.mapToBookingResponse(booking);
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
