import {
  Injectable,
  Inject,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DomainException } from '../../common/exceptions/domain.exception';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { UserRole } from '../auth/types/user-role.enum';
import { BookingStatus } from '../bookings/types/booking-status.enum';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { QueryPaymentsDto } from './dto/query-payments.dto';
import {
  PaymentStatus,
  PaymentAttemptStatus,
  GatewayProvider,
  PaymentMethod,
} from './types/payment-status.enum';
import {
  PaymentResponseDto,
  PaymentAttemptResponseDto,
} from './types/payment-response.type';
import {
  PAYMENT_GATEWAY,
} from './gateways/payment-gateway.interface';
import type { PaymentGateway } from './gateways/payment-gateway.interface';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/types/notification-type.enum';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Process a payment for a booking with database-level idempotency protection.
   */
  async processPayment(
    user: AuthenticatedUser,
    dto: CreatePaymentDto,
    idempotencyKey?: string,
  ): Promise<PaymentResponseDto> {
    // 1. Validate Idempotency-Key
    if (
      !idempotencyKey ||
      typeof idempotencyKey !== 'string' ||
      idempotencyKey.trim().length === 0
    ) {
      throw new DomainException(
        'IDEMPOTENCY_KEY_REQUIRED',
        'Idempotency-Key header is required for payment processing.',
        HttpStatus.BAD_REQUEST,
      );
    }
    const trimmedKey = idempotencyKey.trim();

    // 2. Resolve Idempotency Key & In-Flight Attempts
    let existingAttempt = await this.prisma.paymentAttempt.findUnique({
      where: { idempotencyKey: trimmedKey },
      include: {
        payment: {
          include: {
            attempts: { orderBy: { attemptNumber: 'asc' } },
            booking: { select: { id: true, customerId: true, bookingReference: true } },
          },
        },
        booking: { select: { id: true, customerId: true, bookingReference: true } },
      },
    });

    // Check if an attempt is currently processing for this idempotency key
    if (existingAttempt && existingAttempt.status === PaymentAttemptStatus.PROCESSING) {
      // Wait briefly for in-flight processing to settle
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 50));
        const refreshed = await this.prisma.paymentAttempt.findUnique({
          where: { idempotencyKey: trimmedKey },
          include: {
            payment: {
              include: {
                attempts: { orderBy: { attemptNumber: 'asc' } },
                booking: { select: { id: true, customerId: true, bookingReference: true } },
              },
            },
            booking: { select: { id: true, customerId: true, bookingReference: true } },
          },
        });
        if (refreshed && refreshed.status !== PaymentAttemptStatus.PROCESSING) {
          existingAttempt = refreshed;
          break;
        }
      }
    }

    if (existingAttempt) {
      // Cross-booking key reuse check (Scoped Idempotency)
      if (existingAttempt.bookingId !== dto.bookingId) {
        throw new DomainException(
          'IDEMPOTENCY_KEY_REUSED',
          'This Idempotency-Key has already been used for a different booking.',
          HttpStatus.CONFLICT,
        );
      }

      // Authorization check for existing payment attempt
      if (
        user.role !== UserRole.ADMIN &&
        existingAttempt.booking.customerId !== user.id
      ) {
        throw new DomainException(
          'FORBIDDEN_RESOURCE',
          'You do not have permission to access this payment.',
          HttpStatus.FORBIDDEN,
        );
      }

      // If attempt is STILL processing after wait
      if (existingAttempt.status === PaymentAttemptStatus.PROCESSING) {
        throw new DomainException(
          'PAYMENT_IN_PROGRESS',
          'A payment attempt with this idempotency key is currently processing. Please wait or retry shortly.',
          HttpStatus.CONFLICT,
        );
      }

      // Return previous authoritative idempotent result
      this.logger.log(
        `[PaymentsService] Idempotent request replayed for booking ${dto.bookingId}, key ${trimmedKey}`,
      );
      return this.formatPaymentResponse(existingAttempt.payment);
    }

    // 2b. Check if an attempt with a DIFFERENT key is currently processing for the same booking
    const activeBookingAttempt = await this.prisma.paymentAttempt.findFirst({
      where: {
        bookingId: dto.bookingId,
        status: PaymentAttemptStatus.PROCESSING,
      },
    });

    if (activeBookingAttempt) {
      // Wait briefly for the in-flight attempt on this booking to complete
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 50));
        const checkBooking = await this.prisma.booking.findUnique({
          where: { id: dto.bookingId },
        });
        if (checkBooking && checkBooking.status === BookingStatus.CONFIRMED) {
          throw new DomainException(
            'PAYMENT_ALREADY_COMPLETED',
            'This booking has already been successfully paid.',
            HttpStatus.CONFLICT,
          );
        }
        const checkAttempt = await this.prisma.paymentAttempt.findUnique({
          where: { id: activeBookingAttempt.id },
        });
        if (checkAttempt && checkAttempt.status !== PaymentAttemptStatus.PROCESSING) {
          break;
        }
      }
    }

    // 3. Fetch Booking & Validate Ownership and Payable State
    const booking = await this.prisma.booking.findUnique({
      where: { id: dto.bookingId },
      include: {
        payment: {
          include: {
            attempts: { orderBy: { attemptNumber: 'asc' } },
          },
        },
      },
    });

    if (!booking) {
      throw new DomainException(
        'BOOKING_NOT_FOUND',
        `Booking with ID ${dto.bookingId} not found.`,
        HttpStatus.NOT_FOUND,
      );
    }

    // Authorization: Only the booking's customer (or Admin) can initiate payment
    if (user.role !== UserRole.ADMIN && booking.customerId !== user.id) {
      throw new DomainException(
        'FORBIDDEN_RESOURCE',
        'You do not have permission to pay for this booking.',
        HttpStatus.FORBIDDEN,
      );
    }

    // State machine check: already confirmed / paid
    if (
      booking.status === BookingStatus.CONFIRMED ||
      (booking.payment && booking.payment.status === PaymentStatus.SUCCEEDED)
    ) {
      throw new DomainException(
        'PAYMENT_ALREADY_COMPLETED',
        'This booking has already been successfully paid and confirmed.',
        HttpStatus.CONFLICT,
      );
    }

    if (booking.status === BookingStatus.CANCELLED) {
      throw new DomainException(
        'BOOKING_NOT_PAYABLE',
        'Booking has been cancelled and cannot be paid.',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (booking.status === BookingStatus.EXPIRED) {
      throw new DomainException(
        'BOOKING_NOT_PAYABLE',
        'Booking has expired and cannot be paid.',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (booking.status !== BookingStatus.PENDING) {
      throw new DomainException(
        'BOOKING_NOT_PAYABLE',
        `Booking is not in a payable state: ${booking.status}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    // Check inventory reservation hold expiration
    if (booking.holdExpiresAt && booking.holdExpiresAt.getTime() < Date.now()) {
      await this.prisma.booking.update({
        where: { id: booking.id },
        data: { status: BookingStatus.EXPIRED },
      });
      throw new DomainException(
        'BOOKING_NOT_PAYABLE',
        'The reservation hold for this booking has expired.',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Authoritative payment amount comes strictly from Booking.totalAmountCents
    if (booking.totalAmountCents <= 0n) {
      throw new DomainException(
        'INVALID_PAYMENT_AMOUNT',
        'Authoritative booking total must be greater than zero.',
        HttpStatus.BAD_REQUEST,
      );
    }

    // 4. Phase 1 Database Transaction: Lock row, prepare Payment & create PaymentAttempt
    let attemptRecord: any;
    let paymentRecord: any;

    try {
      const initResult = await this.prisma.$transaction(async (tx) => {
        // Pessimistic row-level lock on the booking
        const lockedBookings = await tx.$queryRaw<{ id: string; status: string }[]>`
          SELECT id, status FROM bookings WHERE id = ${booking.id}::uuid FOR UPDATE
        `;

        if (!lockedBookings || lockedBookings.length === 0) {
          throw new DomainException(
            'BOOKING_NOT_FOUND',
            'Booking not found during transaction lock.',
            HttpStatus.NOT_FOUND,
          );
        }

        const lockedBooking = lockedBookings[0];
        if (lockedBooking.status === BookingStatus.CONFIRMED) {
          const existingTxAttempt = await tx.paymentAttempt.findUnique({
            where: { idempotencyKey: trimmedKey },
          });
          if (existingTxAttempt) {
            const currentPayment = await tx.payment.findUnique({
              where: { bookingId: booking.id },
            });
            return { payment: currentPayment, attempt: existingTxAttempt, isReplay: true };
          }
          throw new DomainException(
            'PAYMENT_ALREADY_COMPLETED',
            'This booking has already been successfully paid.',
            HttpStatus.CONFLICT,
          );
        }

        if (lockedBooking.status !== BookingStatus.PENDING) {
          throw new DomainException(
            'BOOKING_NOT_PAYABLE',
            `Booking is no longer payable: ${lockedBooking.status}`,
            HttpStatus.BAD_REQUEST,
          );
        }

        // Fetch or create logical Payment record
        let currentPayment = await tx.payment.findUnique({
          where: { bookingId: booking.id },
          include: { attempts: { orderBy: { attemptNumber: 'asc' } } },
        });

        if (currentPayment && currentPayment.status === PaymentStatus.SUCCEEDED) {
          throw new DomainException(
            'PAYMENT_ALREADY_COMPLETED',
            'This booking has already been successfully paid.',
            HttpStatus.CONFLICT,
          );
        }

        if (!currentPayment) {
          const txnRef = `TXN-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
          currentPayment = await tx.payment.create({
            data: {
              bookingId: booking.id,
              transactionReference: txnRef,
              idempotencyKey: trimmedKey,
              amountCents: booking.totalAmountCents,
              currency: booking.currency,
              status: PaymentStatus.PENDING,
              gatewayProvider: GatewayProvider.MOCK,
              paymentMethod: dto.paymentMethod || PaymentMethod.CARD,
            },
            include: { attempts: true },
          });
        } else if (currentPayment.status === PaymentStatus.FAILED) {
          // Transition logical payment status back to PENDING for the new retry attempt
          currentPayment = await tx.payment.update({
            where: { id: currentPayment.id },
            data: {
              status: PaymentStatus.PENDING,
              failureReason: null,
            },
            include: { attempts: true },
          });
        }

        // Check if an attempt with a DIFFERENT key is already in progress for this booking
        const inProgressAttempt = await tx.paymentAttempt.findFirst({
          where: {
            bookingId: booking.id,
            status: PaymentAttemptStatus.PROCESSING,
            idempotencyKey: { not: trimmedKey },
          },
        });
        if (inProgressAttempt) {
          throw new DomainException(
            'CONCURRENT_ATTEMPT_IN_PROGRESS',
            inProgressAttempt.id,
            HttpStatus.CONFLICT,
          );
        }

        // Check if an attempt with this key already exists
        const existingTxAttempt = await tx.paymentAttempt.findUnique({
          where: { idempotencyKey: trimmedKey },
        });
        if (existingTxAttempt) {
          return { payment: currentPayment, attempt: existingTxAttempt, isReplay: true };
        }

        // Compute next sequential attempt number
        const nextAttemptNumber = (currentPayment.attempts?.length || 0) + 1;

        // Record new attempt with status PROCESSING
        const newAttempt = await tx.paymentAttempt.create({
          data: {
            paymentId: currentPayment.id,
            bookingId: booking.id,
            attemptNumber: nextAttemptNumber,
            idempotencyKey: trimmedKey,
            amountCents: booking.totalAmountCents,
            currency: booking.currency,
            status: PaymentAttemptStatus.PROCESSING,
            gatewayProvider: GatewayProvider.MOCK,
            paymentMethod: dto.paymentMethod || PaymentMethod.CARD,
          },
        });

        return { payment: currentPayment, attempt: newAttempt, isReplay: false };
      });

      if (initResult.isReplay) {
        // Wait briefly for the in-flight processing to complete
        for (let i = 0; i < 30; i++) {
          await new Promise((r) => setTimeout(r, 50));
          const refreshed = await this.prisma.paymentAttempt.findUnique({
            where: { idempotencyKey: trimmedKey },
            include: {
              payment: {
                include: {
                  attempts: { orderBy: { attemptNumber: 'asc' } },
                  booking: { select: { id: true, customerId: true, bookingReference: true } },
                },
              },
            },
          });
          if (refreshed && refreshed.status !== PaymentAttemptStatus.PROCESSING) {
            return this.formatPaymentResponse(refreshed.payment);
          }
        }
      }

      paymentRecord = initResult.payment;
      attemptRecord = initResult.attempt;
    } catch (err: any) {
      if (
        err instanceof DomainException &&
        err.code === 'CONCURRENT_ATTEMPT_IN_PROGRESS'
      ) {
        const inProgressAttemptId = err.message;
        // Wait for the concurrent in-progress attempt to settle
        for (let i = 0; i < 35; i++) {
          await new Promise((r) => setTimeout(r, 40));
          const checkBooking = await this.prisma.booking.findUnique({
            where: { id: dto.bookingId },
            include: { payment: true },
          });
          if (
            checkBooking &&
            (checkBooking.status === BookingStatus.CONFIRMED ||
              checkBooking.payment?.status === PaymentStatus.SUCCEEDED)
          ) {
            throw new DomainException(
              'PAYMENT_ALREADY_COMPLETED',
              'This booking has already been successfully paid.',
              HttpStatus.CONFLICT,
            );
          }
          const checkAttempt = await this.prisma.paymentAttempt.findUnique({
            where: { id: inProgressAttemptId },
          });
          if (
            checkAttempt &&
            checkAttempt.status !== PaymentAttemptStatus.PROCESSING
          ) {
            break;
          }
        }

        const finalCheckBooking = await this.prisma.booking.findUnique({
          where: { id: dto.bookingId },
          include: { payment: true },
        });
        if (
          finalCheckBooking &&
          (finalCheckBooking.status === BookingStatus.CONFIRMED ||
            finalCheckBooking.payment?.status === PaymentStatus.SUCCEEDED)
        ) {
          throw new DomainException(
            'PAYMENT_ALREADY_COMPLETED',
            'This booking has already been successfully paid.',
            HttpStatus.CONFLICT,
          );
        }

        // In-flight attempt finished without confirming, retry this request
        return this.processPayment(user, dto, idempotencyKey);
      }

      if (err instanceof DomainException) {
        throw err;
      }
      // Handle concurrent insert of the exact same idempotencyKey
      if (
        err?.code === 'P2002' ||
        (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')
      ) {
        for (let i = 0; i < 30; i++) {
          await new Promise((r) => setTimeout(r, 50));
          const raceAttempt = await this.prisma.paymentAttempt.findUnique({
            where: { idempotencyKey: trimmedKey },
            include: {
              payment: {
                include: {
                  attempts: { orderBy: { attemptNumber: 'asc' } },
                  booking: { select: { id: true, customerId: true, bookingReference: true } },
                },
              },
            },
          });
          if (
            raceAttempt &&
            raceAttempt.payment &&
            raceAttempt.status !== PaymentAttemptStatus.PROCESSING
          ) {
            return this.formatPaymentResponse(raceAttempt.payment);
          }
        }
      }
      throw err;
    }

    // 5. External Gateway Execution (Outside long DB transaction)
    const gatewayResult = await this.gateway.processPayment({
      paymentId: paymentRecord.id,
      attemptId: attemptRecord.id,
      bookingId: booking.id,
      amountCents: booking.totalAmountCents,
      currency: booking.currency,
      paymentMethod: dto.paymentMethod,
      idempotencyKey: trimmedKey,
      simulateResult: dto.simulateResult,
      simulateFailureReason: dto.simulateFailureReason,
    });

    // 6. Phase 2 Database Transaction: Atomic state transition
    const finalPayment = await this.prisma.$transaction(async (tx) => {
      if (gatewayResult.success) {
        // Successful attempt
        await tx.paymentAttempt.update({
          where: { id: attemptRecord.id },
          data: {
            status: PaymentAttemptStatus.SUCCEEDED,
            gatewayReference: gatewayResult.gatewayReference,
            updatedAt: new Date(),
          },
        });

        // Update logical payment
        const updatedPayment = await tx.payment.update({
          where: { id: paymentRecord.id },
          data: {
            status: PaymentStatus.SUCCEEDED,
            settledAt: new Date(),
            paymentMethod: dto.paymentMethod || PaymentMethod.CARD,
            failureReason: null,
          },
          include: {
            attempts: { orderBy: { attemptNumber: 'asc' } },
            booking: { select: { bookingReference: true } },
          },
        });

        // Transition booking to CONFIRMED
        await tx.booking.update({
          where: { id: booking.id },
          data: { status: BookingStatus.CONFIRMED },
        });

        return updatedPayment;
      } else {
        // Failed attempt
        await tx.paymentAttempt.update({
          where: { id: attemptRecord.id },
          data: {
            status: PaymentAttemptStatus.FAILED,
            gatewayReference: gatewayResult.gatewayReference,
            failureReason: gatewayResult.failureReason,
            updatedAt: new Date(),
          },
        });

        // Update logical payment to FAILED
        const updatedPayment = await tx.payment.update({
          where: { id: paymentRecord.id },
          data: {
            status: PaymentStatus.FAILED,
            failureReason: gatewayResult.failureReason,
          },
          include: {
            attempts: { orderBy: { attemptNumber: 'asc' } },
            booking: { select: { bookingReference: true } },
          },
        });

        // Booking remains in PENDING so customer can retry before hold expiry
        return updatedPayment;
      }
    });

    // Dispatch Domain Notifications (non-blocking)
    if (finalPayment.status === PaymentStatus.SUCCEEDED) {
      try {
        await this.notificationsService.create({
          userId: booking.customerId,
          type: NotificationType.PAYMENT_SUCCESS,
          title: 'Payment Successful',
          message: 'Your payment was completed successfully.',
          data: {
            bookingId: booking.id,
            paymentId: finalPayment.id,
            amountCents: finalPayment.amountCents.toString(),
          },
        });

        await this.notificationsService.create({
          userId: booking.customerId,
          type: NotificationType.BOOKING_CONFIRMED,
          title: 'Booking Confirmed',
          message: 'Your hotel booking has been confirmed.',
          data: {
            bookingId: booking.id,
            hotelId: booking.hotelId,
            bookingReference: booking.bookingReference,
          },
        });

        await this.notificationsService.createForManagersOfHotel(booking.hotelId, {
          type: NotificationType.BOOKING_CONFIRMED,
          title: 'Booking Confirmed',
          message: `Reservation ${booking.bookingReference} has been confirmed.`,
          data: {
            bookingId: booking.id,
            hotelId: booking.hotelId,
            bookingReference: booking.bookingReference,
          },
        });
      } catch (notifErr: any) {
        this.logger.warn(`Failed to dispatch payment success notifications: ${notifErr.message}`);
      }
    } else if (finalPayment.status === PaymentStatus.FAILED) {
      try {
        await this.notificationsService.create({
          userId: booking.customerId,
          type: NotificationType.PAYMENT_FAILED,
          title: 'Payment Failed',
          message: 'Your payment could not be completed.',
          data: {
            bookingId: booking.id,
            paymentId: finalPayment.id,
            reason: finalPayment.failureReason || 'Declined',
          },
        });
      } catch (notifErr: any) {
        this.logger.warn(`Failed to dispatch payment failed notification: ${notifErr.message}`);
      }
    }

    return this.formatPaymentResponse(finalPayment);
  }

  /**
   * Retrieve a payment by ID with attempts and ownership verification.
   */
  async getPaymentById(
    user: AuthenticatedUser,
    paymentId: string,
  ): Promise<PaymentResponseDto> {
    // Managers are forbidden from viewing sensitive customer payment details
    if (user.role === UserRole.MANAGER) {
      throw new DomainException(
        'FORBIDDEN_RESOURCE',
        'Managers are not authorized to view customer payment information.',
        HttpStatus.FORBIDDEN,
      );
    }

    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        attempts: { orderBy: { attemptNumber: 'asc' } },
        booking: {
          select: {
            id: true,
            customerId: true,
            bookingReference: true,
          },
        },
      },
    });

    if (!payment) {
      throw new DomainException(
        'PAYMENT_NOT_FOUND',
        `Payment with ID ${paymentId} not found.`,
        HttpStatus.NOT_FOUND,
      );
    }

    // Customer can only view their own payment
    if (user.role === UserRole.CUSTOMER && payment.booking.customerId !== user.id) {
      throw new DomainException(
        'FORBIDDEN_RESOURCE',
        'You do not have permission to access this payment.',
        HttpStatus.FORBIDDEN,
      );
    }

    return this.formatPaymentResponse(payment);
  }

  /**
   * Retrieve payments with pagination and role-based filtering.
   */
  async getPayments(
    user: AuthenticatedUser,
    query: QueryPaymentsDto,
  ): Promise<{
    items: PaymentResponseDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    if (user.role === UserRole.MANAGER) {
      throw new DomainException(
        'FORBIDDEN_RESOURCE',
        'Managers are not authorized to view payment records.',
        HttpStatus.FORBIDDEN,
      );
    }

    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 20;
    const skip = (page - 1) * limit;

    const whereClause: Prisma.PaymentWhereInput = {};

    if (user.role === UserRole.CUSTOMER) {
      whereClause.booking = { customerId: user.id };
    }

    if (query.bookingId) {
      if (user.role === UserRole.CUSTOMER) {
        whereClause.booking = {
          id: query.bookingId,
          customerId: user.id,
        };
      } else {
        whereClause.bookingId = query.bookingId;
      }
    }

    const [total, payments] = await Promise.all([
      this.prisma.payment.count({ where: whereClause }),
      this.prisma.payment.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          attempts: { orderBy: { attemptNumber: 'asc' } },
          booking: {
            select: {
              id: true,
              customerId: true,
              bookingReference: true,
            },
          },
        },
      }),
    ]);

    return {
      items: payments.map((p) => this.formatPaymentResponse(p)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Formats raw Prisma Payment into a clean, sanitized response without sensitive leaks.
   */
  private formatPaymentResponse(payment: any): PaymentResponseDto {
    const formattedAttempts: PaymentAttemptResponseDto[] = (
      payment.attempts || []
    ).map((att: any) => ({
      id: att.id,
      attemptNumber: att.attemptNumber,
      idempotencyKey: att.idempotencyKey,
      amount: (Number(att.amountCents) / 100).toFixed(2),
      currency: att.currency,
      status: att.status,
      gatewayProvider: att.gatewayProvider,
      gatewayReference: att.gatewayReference ?? null,
      paymentMethod: att.paymentMethod ?? null,
      failureReason: att.failureReason ?? null,
      createdAt:
        att.createdAt instanceof Date ? att.createdAt.toISOString() : att.createdAt,
      updatedAt:
        att.updatedAt instanceof Date ? att.updatedAt.toISOString() : att.updatedAt,
    }));

    return {
      id: payment.id,
      bookingId: payment.bookingId,
      bookingReference: payment.booking?.bookingReference ?? undefined,
      transactionReference: payment.transactionReference,
      status: payment.status,
      amount: (Number(payment.amountCents) / 100).toFixed(2),
      currency: payment.currency,
      gatewayProvider: payment.gatewayProvider,
      paymentMethod: payment.paymentMethod ?? null,
      failureReason: payment.failureReason ?? null,
      settledAt: payment.settledAt
        ? payment.settledAt instanceof Date
          ? payment.settledAt.toISOString()
          : payment.settledAt
        : null,
      createdAt:
        payment.createdAt instanceof Date
          ? payment.createdAt.toISOString()
          : payment.createdAt,
      attempts: formattedAttempts,
    };
  }
}
