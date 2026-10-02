import { Injectable, HttpStatus, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DomainException } from '../../common/exceptions/domain.exception';
import { HotelAuthorizationService } from '../hotels/authorization/hotel-authorization.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/types/notification-type.enum';
import { BookingStatus, BookingRoomStatus } from './types/booking-status.enum';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { UserRole } from '../auth/types/user-role.enum';
import { BookingResponse } from './types/booking-response.type';
import { RealtimeService } from '../../infrastructure/realtime/realtime.service';
import { RealtimeEventType } from '../../infrastructure/realtime/realtime.events';

@Injectable()
export class BookingLifecycleService {
  private readonly logger = new Logger(BookingLifecycleService.name);

  /**
   * Authoritative, centralized state machine transition map.
   *
   * Lifecycle Paths:
   *   PENDING -> CONFIRMED | CANCELLED | EXPIRED
   *   CONFIRMED -> CHECKED_IN | CANCELLED | NO_SHOW
   *   CHECKED_IN -> CHECKED_OUT
   *   CHECKED_OUT -> terminal
   *   CANCELLED -> terminal
   *   EXPIRED -> terminal
   *   NO_SHOW -> terminal
   */
  private readonly allowedTransitions: Record<BookingStatus, BookingStatus[]> = {
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

  constructor(
    private readonly prisma: PrismaService,
    private readonly hotelAuthorizationService: HotelAuthorizationService,
    private readonly notificationsService: NotificationsService,
    @Optional() private readonly realtimeService?: RealtimeService,
  ) {}

  /**
   * Evaluates if a state transition from `currentStatus` to `targetStatus` is valid.
   */
  canTransition(currentStatus: BookingStatus, targetStatus: BookingStatus): boolean {
    const validTargets = this.allowedTransitions[currentStatus] || [];
    return validTargets.includes(targetStatus);
  }

  /**
   * Returns list of valid target states from current status.
   */
  getValidTransitions(currentStatus: BookingStatus): BookingStatus[] {
    return this.allowedTransitions[currentStatus] || [];
  }

  /**
   * Asserts valid transition or throws DomainException with HTTP 400.
   */
  assertValidTransition(currentStatus: BookingStatus, targetStatus: BookingStatus): void {
    if (!this.canTransition(currentStatus, targetStatus)) {
      throw new DomainException(
        'INVALID_STATE_TRANSITION',
        `Cannot transition reservation from ${currentStatus} to ${targetStatus}.`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Cancels an eligible reservation (PENDING or CONFIRMED).
   * Atomically marks booking CANCELLED, releases allocated rooms, and records audit log.
   * Preserves historical records; does not delete allocations or bookings.
   */
  async cancelBooking(
    user: AuthenticatedUser,
    bookingId: string,
    reason?: string,
  ): Promise<BookingResponse> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        hotel: { select: { id: true, name: true, slug: true, city: true } },
        bookingRooms: true,
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
        'Unauthorized to perform cancellation.',
        HttpStatus.FORBIDDEN,
      );
    }

    // State machine check
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

    if (booking.status === BookingStatus.CHECKED_IN) {
      throw new DomainException(
        'BOOKING_NOT_CANCELLABLE',
        'Checked-in reservations cannot be cancelled.',
        HttpStatus.BAD_REQUEST,
      );
    }

    this.assertValidTransition(booking.status as BookingStatus, BookingStatus.CANCELLED);

    // Concurrency-safe atomic transaction with pessimistic row lock
    const updatedBooking = await this.prisma.$transaction(async (tx) => {
      const [locked] = await tx.$queryRaw<{ id: string; status: string }[]>`
        SELECT id, status FROM bookings WHERE id = ${bookingId}::uuid FOR UPDATE
      `;

      if (!locked) {
        throw new DomainException(
          'BOOKING_NOT_FOUND',
          'Booking not found during transaction lock.',
          HttpStatus.NOT_FOUND,
        );
      }

      if (locked.status === BookingStatus.CANCELLED) {
        throw new DomainException(
          'BOOKING_ALREADY_CANCELLED',
          'This reservation is already cancelled.',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (
        locked.status === BookingStatus.CHECKED_IN ||
        locked.status === BookingStatus.CHECKED_OUT ||
        locked.status === BookingStatus.EXPIRED
      ) {
        throw new DomainException(
          'BOOKING_NOT_CANCELLABLE',
          `Cannot cancel reservation in state ${locked.status}.`,
          HttpStatus.BAD_REQUEST,
        );
      }

      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: BookingStatus.CANCELLED,
          cancelledAt: new Date(),
          cancellationReason: reason || 'Cancelled by user',
        },
        include: {
          hotel: { select: { id: true, name: true, slug: true, city: true } },
          bookingRooms: {
            include: {
              room: { select: { id: true, roomNumber: true, floor: true } },
              roomType: { select: { id: true, name: true, slug: true } },
            },
          },
          priceSnapshot: true,
          customer: {
            select: { id: true, firstName: true, lastName: true, email: true, phone: true },
          },
        },
      });

      // Release allocated physical rooms (status = CANCELLED)
      await tx.bookingRoom.updateMany({
        where: { bookingId },
        data: { status: BookingRoomStatus.CANCELLED },
      });

      // Audit Log
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: 'booking.cancelled',
          entityType: 'Booking',
          entityId: bookingId,
          oldValues: { status: booking.status },
          newValues: { status: BookingStatus.CANCELLED, cancellationReason: reason },
        },
      });

      this.logger.log(`[BookingLifecycle] Booking ${bookingId} cancelled by ${user.email}`);
      return updated;
    });

    // Dispatch Domain Notifications (non-blocking)
    try {
      await this.notificationsService.create({
        userId: updatedBooking.customerId,
        type: NotificationType.BOOKING_CANCELLED,
        title: 'Booking Cancelled',
        message: 'Your booking has been cancelled.',
        data: {
          bookingId: updatedBooking.id,
          hotelId: updatedBooking.hotelId,
          bookingReference: updatedBooking.bookingReference,
        },
      });

      await this.notificationsService.createForManagersOfHotel(updatedBooking.hotelId, {
        type: NotificationType.BOOKING_CANCELLED,
        title: 'Booking Cancelled',
        message: `Reservation ${updatedBooking.bookingReference} has been cancelled.`,
        data: {
          bookingId: updatedBooking.id,
          hotelId: updatedBooking.hotelId,
          bookingReference: updatedBooking.bookingReference,
        },
      });
    } catch (notifErr: any) {
      this.logger.warn(`Failed to dispatch booking cancelled notification: ${notifErr.message}`);
    }

    // Publish Realtime SSE Event (post-commit)
    try {
      if (this.realtimeService) {
        await this.realtimeService.publish(
          RealtimeEventType.BOOKING_CANCELLED,
          {
            bookingId: updatedBooking.id,
            bookingReference: updatedBooking.bookingReference,
            hotelId: updatedBooking.hotelId,
            customerId: updatedBooking.customerId,
            status: updatedBooking.status,
            reason,
          },
          {
            userId: updatedBooking.customerId,
            hotelId: updatedBooking.hotelId,
            includeAdmins: true,
          },
        );
      }
    } catch (realtimeErr: any) {
      this.logger.warn(
        `Failed to publish real-time BOOKING_CANCELLED event: ${realtimeErr.message}`,
      );
    }

    return this.mapToBookingResponse(updatedBooking, 'Booking cancelled successfully.');
  }

  /**
   * Checks in a guest for a CONFIRMED reservation.
   * Restricted to assigned HOTEL_MANAGER or ADMIN.
   */
  async checkInBooking(user: AuthenticatedUser, bookingId: string): Promise<BookingResponse> {
    if (user.role === UserRole.CUSTOMER) {
      throw new DomainException(
        'FORBIDDEN',
        'Customers cannot check in reservations. Only hotel staff or administrators may perform check-in.',
        HttpStatus.FORBIDDEN,
      );
    }

    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        hotel: { select: { id: true, name: true, slug: true, city: true } },
        bookingRooms: true,
      },
    });

    if (!booking) {
      throw new DomainException(
        'BOOKING_NOT_FOUND',
        'Reservation record not found.',
        HttpStatus.NOT_FOUND,
      );
    }

    // Manager assignment check
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
        'Unauthorized to perform check-in.',
        HttpStatus.FORBIDDEN,
      );
    }

    // State check
    if (booking.status === BookingStatus.CHECKED_IN) {
      throw new DomainException(
        'BOOKING_ALREADY_CHECKED_IN',
        'Reservation is already checked in.',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (booking.status === BookingStatus.PENDING) {
      throw new DomainException(
        'BOOKING_NOT_CHECKINABLE',
        'Pending reservation must be paid and confirmed before check-in.',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (booking.status === BookingStatus.CANCELLED) {
      throw new DomainException(
        'BOOKING_NOT_CHECKINABLE',
        'Cancelled reservations cannot be checked in.',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (booking.status === BookingStatus.EXPIRED) {
      throw new DomainException(
        'BOOKING_NOT_CHECKINABLE',
        'Expired reservations cannot be checked in.',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (booking.status === BookingStatus.CHECKED_OUT) {
      throw new DomainException(
        'BOOKING_NOT_CHECKINABLE',
        'Completed/checked-out reservations cannot be checked in.',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Stay period date check: cannot check in after checkout date has passed
    const now = new Date();
    if (booking.checkOutDate && now >= booking.checkOutDate) {
      throw new DomainException(
        'BOOKING_NOT_CHECKINABLE',
        `Cannot check in reservation after scheduled checkout date (${booking.checkOutDate.toISOString().split('T')[0]}) has passed.`,
        HttpStatus.BAD_REQUEST,
      );
    }

    this.assertValidTransition(booking.status as BookingStatus, BookingStatus.CHECKED_IN);

    // Concurrency-safe atomic transaction with pessimistic row lock
    const updatedBooking = await this.prisma.$transaction(async (tx) => {
      const [locked] = await tx.$queryRaw<{ id: string; status: string }[]>`
        SELECT id, status FROM bookings WHERE id = ${bookingId}::uuid FOR UPDATE
      `;

      if (!locked) {
        throw new DomainException(
          'BOOKING_NOT_FOUND',
          'Booking not found during transaction lock.',
          HttpStatus.NOT_FOUND,
        );
      }

      if (locked.status === BookingStatus.CHECKED_IN) {
        throw new DomainException(
          'BOOKING_ALREADY_CHECKED_IN',
          'Reservation is already checked in.',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (locked.status !== BookingStatus.CONFIRMED) {
        throw new DomainException(
          'BOOKING_NOT_CHECKINABLE',
          `Cannot check in reservation in state ${locked.status}. Must be CONFIRMED.`,
          HttpStatus.BAD_REQUEST,
        );
      }

      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: BookingStatus.CHECKED_IN,
          checkedInAt: new Date(),
        },
        include: {
          hotel: { select: { id: true, name: true, slug: true, city: true } },
          bookingRooms: {
            include: {
              room: { select: { id: true, roomNumber: true, floor: true } },
              roomType: { select: { id: true, name: true, slug: true } },
            },
          },
          priceSnapshot: true,
          customer: {
            select: { id: true, firstName: true, lastName: true, email: true, phone: true },
          },
        },
      });

      // Mark allocated rooms as OCCUPIED
      await tx.bookingRoom.updateMany({
        where: { bookingId },
        data: { status: BookingRoomStatus.OCCUPIED },
      });

      // Audit Log
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: 'booking.checked_in',
          entityType: 'Booking',
          entityId: bookingId,
          oldValues: { status: booking.status },
          newValues: { status: BookingStatus.CHECKED_IN, checkedInAt: new Date().toISOString() },
        },
      });

      this.logger.log(`[BookingLifecycle] Booking ${bookingId} checked in by ${user.email}`);
      return updated;
    });

    // Dispatch Domain Notifications (non-blocking)
    try {
      await this.notificationsService.create({
        userId: updatedBooking.customerId,
        type: NotificationType.CHECK_IN_COMPLETED,
        title: 'Check-in Completed',
        message: 'You have successfully checked in.',
        data: {
          bookingId: updatedBooking.id,
          hotelId: updatedBooking.hotelId,
          bookingReference: updatedBooking.bookingReference,
        },
      });

      await this.notificationsService.createForManagersOfHotel(updatedBooking.hotelId, {
        type: NotificationType.CHECK_IN_COMPLETED,
        title: 'Guest Checked In',
        message: `Guest for reservation ${updatedBooking.bookingReference} has checked in.`,
        data: {
          bookingId: updatedBooking.id,
          hotelId: updatedBooking.hotelId,
          bookingReference: updatedBooking.bookingReference,
        },
      });
    } catch (notifErr: any) {
      this.logger.warn(`Failed to dispatch check-in notification: ${notifErr.message}`);
    }

    // Publish Realtime SSE Event (post-commit)
    try {
      if (this.realtimeService) {
        await this.realtimeService.publish(
          RealtimeEventType.CHECKED_IN,
          {
            bookingId: updatedBooking.id,
            bookingReference: updatedBooking.bookingReference,
            hotelId: updatedBooking.hotelId,
            customerId: updatedBooking.customerId,
            status: updatedBooking.status,
          },
          {
            userId: updatedBooking.customerId,
            hotelId: updatedBooking.hotelId,
            includeAdmins: true,
          },
        );
      }
    } catch (realtimeErr: any) {
      this.logger.warn(
        `Failed to publish real-time CHECKED_IN event: ${realtimeErr.message}`,
      );
    }

    return this.mapToBookingResponse(updatedBooking, 'Booking checked in successfully.');
  }

  /**
   * Checks out a guest for an active CHECKED_IN reservation.
   * Restricted to assigned HOTEL_MANAGER or ADMIN.
   */
  async checkOutBooking(user: AuthenticatedUser, bookingId: string): Promise<BookingResponse> {
    if (user.role === UserRole.CUSTOMER) {
      throw new DomainException(
        'FORBIDDEN',
        'Customers cannot check out reservations. Only hotel staff or administrators may perform check-out.',
        HttpStatus.FORBIDDEN,
      );
    }

    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        hotel: { select: { id: true, name: true, slug: true, city: true } },
        bookingRooms: true,
      },
    });

    if (!booking) {
      throw new DomainException(
        'BOOKING_NOT_FOUND',
        'Reservation record not found.',
        HttpStatus.NOT_FOUND,
      );
    }

    // Manager assignment check
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
        'Unauthorized to perform check-out.',
        HttpStatus.FORBIDDEN,
      );
    }

    // State check
    if (booking.status === BookingStatus.CHECKED_OUT) {
      throw new DomainException(
        'BOOKING_ALREADY_COMPLETED',
        'Reservation is already checked out/completed.',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (booking.status !== BookingStatus.CHECKED_IN) {
      throw new DomainException(
        'BOOKING_NOT_CHECKOUTABLE',
        `Cannot check out reservation in state ${booking.status}. Reservation must be CHECKED_IN.`,
        HttpStatus.BAD_REQUEST,
      );
    }

    this.assertValidTransition(booking.status as BookingStatus, BookingStatus.CHECKED_OUT);

    // Concurrency-safe atomic transaction with pessimistic row lock
    const updatedBooking = await this.prisma.$transaction(async (tx) => {
      const [locked] = await tx.$queryRaw<{ id: string; status: string }[]>`
        SELECT id, status FROM bookings WHERE id = ${bookingId}::uuid FOR UPDATE
      `;

      if (!locked) {
        throw new DomainException(
          'BOOKING_NOT_FOUND',
          'Booking not found during transaction lock.',
          HttpStatus.NOT_FOUND,
        );
      }

      if (locked.status === BookingStatus.CHECKED_OUT) {
        throw new DomainException(
          'BOOKING_ALREADY_COMPLETED',
          'Reservation is already checked out/completed.',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (locked.status !== BookingStatus.CHECKED_IN) {
        throw new DomainException(
          'BOOKING_NOT_CHECKOUTABLE',
          `Cannot check out reservation in state ${locked.status}. Must be CHECKED_IN.`,
          HttpStatus.BAD_REQUEST,
        );
      }

      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: BookingStatus.CHECKED_OUT,
          checkedOutAt: new Date(),
        },
        include: {
          hotel: { select: { id: true, name: true, slug: true, city: true } },
          bookingRooms: {
            include: {
              room: { select: { id: true, roomNumber: true, floor: true } },
              roomType: { select: { id: true, name: true, slug: true } },
            },
          },
          priceSnapshot: true,
          customer: {
            select: { id: true, firstName: true, lastName: true, email: true, phone: true },
          },
        },
      });

      // Release allocated physical rooms (status = RELEASED)
      await tx.bookingRoom.updateMany({
        where: { bookingId },
        data: { status: BookingRoomStatus.RELEASED },
      });

      // Audit Log
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: 'booking.checked_out',
          entityType: 'Booking',
          entityId: bookingId,
          oldValues: { status: booking.status },
          newValues: { status: BookingStatus.CHECKED_OUT, checkedOutAt: new Date().toISOString() },
        },
      });

      this.logger.log(`[BookingLifecycle] Booking ${bookingId} checked out by ${user.email}`);
      return updated;
    });

    // Dispatch Domain Notifications (non-blocking)
    try {
      await this.notificationsService.create({
        userId: updatedBooking.customerId,
        type: NotificationType.CHECK_OUT_COMPLETED,
        title: 'Check-out Completed',
        message: 'Your stay has been completed.',
        data: {
          bookingId: updatedBooking.id,
          hotelId: updatedBooking.hotelId,
          bookingReference: updatedBooking.bookingReference,
        },
      });

      await this.notificationsService.createForManagersOfHotel(updatedBooking.hotelId, {
        type: NotificationType.CHECK_OUT_COMPLETED,
        title: 'Guest Checked Out',
        message: `Guest for reservation ${updatedBooking.bookingReference} has completed check-out.`,
        data: {
          bookingId: updatedBooking.id,
          hotelId: updatedBooking.hotelId,
          bookingReference: updatedBooking.bookingReference,
        },
      });
    } catch (notifErr: any) {
      this.logger.warn(`Failed to dispatch check-out notification: ${notifErr.message}`);
    }

    // Publish Realtime SSE Event (post-commit)
    try {
      if (this.realtimeService) {
        await this.realtimeService.publish(
          RealtimeEventType.CHECKED_OUT,
          {
            bookingId: updatedBooking.id,
            bookingReference: updatedBooking.bookingReference,
            hotelId: updatedBooking.hotelId,
            customerId: updatedBooking.customerId,
            status: updatedBooking.status,
          },
          {
            userId: updatedBooking.customerId,
            hotelId: updatedBooking.hotelId,
            includeAdmins: true,
          },
        );
      }
    } catch (realtimeErr: any) {
      this.logger.warn(
        `Failed to publish real-time CHECKED_OUT event: ${realtimeErr.message}`,
      );
    }

    return this.mapToBookingResponse(updatedBooking, 'Booking checked out successfully.');
  }

  /**
   * General state transition helper for managers/admins.
   * Delegates specific actions to dedicated lifecycle handlers or performs allowed transitions.
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

    this.assertValidTransition(booking.status as BookingStatus, targetStatus);

    if (targetStatus === BookingStatus.CANCELLED) {
      return this.cancelBooking(user, bookingId);
    }
    if (targetStatus === BookingStatus.CHECKED_IN) {
      return this.checkInBooking(user, bookingId);
    }
    if (targetStatus === BookingStatus.CHECKED_OUT) {
      return this.checkOutBooking(user, bookingId);
    }

    const updatedBooking = await this.prisma.$transaction(async (tx) => {
      const [locked] = await tx.$queryRaw<{ id: string; status: string }[]>`
        SELECT id, status FROM bookings WHERE id = ${bookingId}::uuid FOR UPDATE
      `;

      if (!locked) {
        throw new DomainException(
          'BOOKING_NOT_FOUND',
          'Booking not found during transaction lock.',
          HttpStatus.NOT_FOUND,
        );
      }

      this.assertValidTransition(locked.status as BookingStatus, targetStatus);

      const updateData: any = { status: targetStatus };

      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: updateData,
        include: {
          hotel: { select: { id: true, name: true, slug: true, city: true } },
          bookingRooms: {
            include: {
              room: { select: { id: true, roomNumber: true, floor: true } },
              roomType: { select: { id: true, name: true, slug: true } },
            },
          },
          priceSnapshot: true,
          customer: {
            select: { id: true, firstName: true, lastName: true, email: true, phone: true },
          },
        },
      });

      if (targetStatus === BookingStatus.NO_SHOW) {
        await tx.bookingRoom.updateMany({
          where: { bookingId },
          data: { status: BookingRoomStatus.RELEASED },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: `booking.${targetStatus.toLowerCase()}`,
          entityType: 'Booking',
          entityId: bookingId,
          oldValues: { status: locked.status },
          newValues: { status: targetStatus },
        },
      });

      return updated;
    });

    return this.mapToBookingResponse(updatedBooking);
  }

  /**
   * Expires an individual pending reservation whose hold window has elapsed.
   */
  async expireBooking(bookingId: string): Promise<BookingResponse> {
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

    if (booking.status !== BookingStatus.PENDING) {
      throw new DomainException(
        'INVALID_STATE_TRANSITION',
        `Only PENDING bookings can expire. Current status: ${booking.status}.`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const updatedBooking = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: { status: BookingStatus.EXPIRED },
        include: {
          hotel: { select: { id: true, name: true, slug: true, city: true } },
          bookingRooms: {
            include: {
              room: { select: { id: true, roomNumber: true, floor: true } },
              roomType: { select: { id: true, name: true, slug: true } },
            },
          },
          priceSnapshot: true,
          customer: {
            select: { id: true, firstName: true, lastName: true, email: true, phone: true },
          },
        },
      });

      await tx.bookingRoom.updateMany({
        where: { bookingId },
        data: { status: BookingRoomStatus.CANCELLED },
      });

      await tx.auditLog.create({
        data: {
          action: 'booking.expired',
          entityType: 'Booking',
          entityId: bookingId,
          oldValues: { status: BookingStatus.PENDING },
          newValues: { status: BookingStatus.EXPIRED },
        },
      });

      return updated;
    });

    return this.mapToBookingResponse(updatedBooking, 'Booking hold expired.');
  }

  /**
   * Scans and expires all stale PENDING bookings whose temporary reservation hold window has elapsed.
   * Can be triggered programmatically, via cron, or by BullMQ scheduler in future phases.
   */
  async expireStalePendingBookings(): Promise<number> {
    const now = new Date();
    const staleBookings = await this.prisma.booking.findMany({
      where: {
        status: BookingStatus.PENDING,
        holdExpiresAt: { lt: now },
      },
      select: { id: true },
    });

    if (staleBookings.length === 0) {
      return 0;
    }

    let expiredCount = 0;
    for (const b of staleBookings) {
      try {
        await this.expireBooking(b.id);
        expiredCount++;
      } catch (err: any) {
        this.logger.error(`Failed to expire stale booking ${b.id}: ${err.message}`);
      }
    }

    this.logger.log(`[BookingLifecycle] Expired ${expiredCount} stale pending reservation holds.`);
    return expiredCount;
  }

  /**
   * Helper to map raw Prisma booking records to client-safe BookingResponse DTOs.
   */
  mapToBookingResponse(booking: any, message?: string): BookingResponse {
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
      customer: booking.customer
        ? {
            id: booking.customer.id,
            firstName: booking.customer.firstName,
            lastName: booking.customer.lastName,
            email: booking.customer.email,
            phone: booking.customer.phone,
          }
        : undefined,
      message,
    };
  }
}
