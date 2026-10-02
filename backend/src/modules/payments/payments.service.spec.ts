import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MockPaymentGateway } from './gateways/mock-payment.gateway';
import { PAYMENT_GATEWAY } from './gateways/payment-gateway.interface';
import { DomainException } from '../../common/exceptions/domain.exception';
import { UserRole } from '../auth/types/user-role.enum';
import { BookingStatus } from '../bookings/types/booking-status.enum';
import {
  PaymentStatus,
  PaymentAttemptStatus,
} from './types/payment-status.enum';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { NotificationsService } from '../notifications/notifications.service';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prisma: any;
  let gateway: MockPaymentGateway;

  const mockCustomerUser: AuthenticatedUser = {
    id: 'user-customer-1111-1111',
    email: 'customer@stayora.com',
    role: UserRole.CUSTOMER,
    status: 'ACTIVE',
  };

  const mockOtherCustomerUser: AuthenticatedUser = {
    id: 'user-customer-2222-2222',
    email: 'other@stayora.com',
    role: UserRole.CUSTOMER,
    status: 'ACTIVE',
  };

  const mockManagerUser: AuthenticatedUser = {
    id: 'user-manager-3333-3333',
    email: 'manager@stayora.com',
    role: UserRole.MANAGER,
    status: 'ACTIVE',
  };

  const mockAdminUser: AuthenticatedUser = {
    id: 'user-admin-4444-4444',
    email: 'admin@stayora.com',
    role: UserRole.ADMIN,
    status: 'ACTIVE',
  };

  const mockBooking = {
    id: 'booking-uuid-1',
    bookingReference: 'STY-202610-0001',
    customerId: mockCustomerUser.id,
    hotelId: 'hotel-uuid-1',
    status: BookingStatus.PENDING,
    totalAmountCents: BigInt(1350000), // 13500.00
    currency: 'INR',
    holdExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
    payment: null,
  };

  beforeEach(async () => {
    prisma = {
      booking: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      payment: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
      paymentAttempt: {
        findUnique: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      $queryRaw: jest.fn(),
      $transaction: jest.fn((callback) => callback(prisma)),
    };

    const notificationsService = {
      create: jest.fn().mockResolvedValue({ id: 'mock-notif-id' }),
      createForManagersOfHotel: jest.fn().mockResolvedValue(1),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notificationsService },
        MockPaymentGateway,
        {
          provide: PAYMENT_GATEWAY,
          useClass: MockPaymentGateway,
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    gateway = module.get<MockPaymentGateway>(PAYMENT_GATEWAY);
  });

  describe('Validation & Idempotency Rules', () => {
    it('should throw BAD_REQUEST if Idempotency-Key is missing or empty', async () => {
      await expect(
        service.processPayment(
          mockCustomerUser,
          { bookingId: mockBooking.id },
          '',
        ),
      ).rejects.toThrow(DomainException);

      await expect(
        service.processPayment(
          mockCustomerUser,
          { bookingId: mockBooking.id },
          undefined as any,
        ),
      ).rejects.toMatchObject({
        code: 'IDEMPOTENCY_KEY_REQUIRED',
        status: HttpStatus.BAD_REQUEST,
      });
    });

    it('should return existing payment when valid Idempotency-Key is replayed for the same booking', async () => {
      const existingPayment = {
        id: 'payment-1',
        bookingId: mockBooking.id,
        transactionReference: 'TXN-1',
        idempotencyKey: 'IDEMP-1',
        amountCents: BigInt(1350000),
        currency: 'INR',
        status: PaymentStatus.SUCCEEDED,
        gatewayProvider: 'MOCK',
        paymentMethod: 'CARD',
        failureReason: null,
        settledAt: new Date(),
        createdAt: new Date(),
        booking: { id: mockBooking.id, customerId: mockCustomerUser.id, bookingReference: 'STY-001' },
        attempts: [
          {
            id: 'attempt-1',
            attemptNumber: 1,
            idempotencyKey: 'IDEMP-1',
            amountCents: BigInt(1350000),
            currency: 'INR',
            status: PaymentAttemptStatus.SUCCEEDED,
            gatewayProvider: 'MOCK',
            gatewayReference: 'MOCK-REF-1',
            paymentMethod: 'CARD',
            failureReason: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      };

      prisma.paymentAttempt.findUnique.mockResolvedValue({
        id: 'attempt-1',
        bookingId: mockBooking.id,
        status: PaymentAttemptStatus.SUCCEEDED,
        booking: { id: mockBooking.id, customerId: mockCustomerUser.id },
        payment: existingPayment,
      });

      const res = await service.processPayment(
        mockCustomerUser,
        { bookingId: mockBooking.id },
        'IDEMP-1',
      );

      expect(res.id).toBe('payment-1');
      expect(res.status).toBe(PaymentStatus.SUCCEEDED);
      expect(res.amount).toBe('13500.00');
      expect(prisma.payment.create).not.toHaveBeenCalled();
      expect(prisma.booking.update).not.toHaveBeenCalled();
    });

    it('should reject with 409 CONFLICT if Idempotency-Key is reused for a different booking', async () => {
      prisma.paymentAttempt.findUnique.mockResolvedValue({
        id: 'attempt-1',
        bookingId: 'different-booking-id',
        status: PaymentAttemptStatus.SUCCEEDED,
        booking: { id: 'different-booking-id', customerId: mockCustomerUser.id },
      });

      await expect(
        service.processPayment(
          mockCustomerUser,
          { bookingId: mockBooking.id },
          'IDEMP-REUSED',
        ),
      ).rejects.toMatchObject({
        code: 'IDEMPOTENCY_KEY_REUSED',
        status: HttpStatus.CONFLICT,
      });
    });

    it('should reject with 409 CONFLICT if payment attempt is currently in progress', async () => {
      prisma.paymentAttempt.findUnique.mockResolvedValue({
        id: 'attempt-1',
        bookingId: mockBooking.id,
        status: PaymentAttemptStatus.PROCESSING,
        booking: { id: mockBooking.id, customerId: mockCustomerUser.id },
      });

      await expect(
        service.processPayment(
          mockCustomerUser,
          { bookingId: mockBooking.id },
          'IDEMP-PROCESSING',
        ),
      ).rejects.toMatchObject({
        code: 'PAYMENT_IN_PROGRESS',
        status: HttpStatus.CONFLICT,
      });
    });
  });

  describe('Booking State Validation', () => {
    beforeEach(() => {
      prisma.paymentAttempt.findUnique.mockResolvedValue(null);
    });

    it('should throw 404 NOT_FOUND if booking does not exist', async () => {
      prisma.booking.findUnique.mockResolvedValue(null);

      await expect(
        service.processPayment(
          mockCustomerUser,
          { bookingId: 'non-existent-booking' },
          'IDEMP-NEW',
        ),
      ).rejects.toMatchObject({
        code: 'BOOKING_NOT_FOUND',
        status: HttpStatus.NOT_FOUND,
      });
    });

    it('should throw 403 FORBIDDEN if customer does not own the booking', async () => {
      prisma.booking.findUnique.mockResolvedValue(mockBooking);

      await expect(
        service.processPayment(
          mockOtherCustomerUser,
          { bookingId: mockBooking.id },
          'IDEMP-NEW',
        ),
      ).rejects.toMatchObject({
        code: 'FORBIDDEN_RESOURCE',
        status: HttpStatus.FORBIDDEN,
      });
    });

    it('should throw 409 CONFLICT if booking is already CONFIRMED', async () => {
      prisma.booking.findUnique.mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.CONFIRMED,
      });

      await expect(
        service.processPayment(
          mockCustomerUser,
          { bookingId: mockBooking.id },
          'IDEMP-NEW',
        ),
      ).rejects.toMatchObject({
        code: 'PAYMENT_ALREADY_COMPLETED',
        status: HttpStatus.CONFLICT,
      });
    });

    it('should throw 400 BAD_REQUEST if booking is CANCELLED', async () => {
      prisma.booking.findUnique.mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.CANCELLED,
      });

      await expect(
        service.processPayment(
          mockCustomerUser,
          { bookingId: mockBooking.id },
          'IDEMP-NEW',
        ),
      ).rejects.toMatchObject({
        code: 'BOOKING_NOT_PAYABLE',
        status: HttpStatus.BAD_REQUEST,
      });
    });

    it('should throw 400 BAD_REQUEST if booking hold has expired', async () => {
      prisma.booking.findUnique.mockResolvedValue({
        ...mockBooking,
        holdExpiresAt: new Date(Date.now() - 5000), // past
      });

      await expect(
        service.processPayment(
          mockCustomerUser,
          { bookingId: mockBooking.id },
          'IDEMP-NEW',
        ),
      ).rejects.toMatchObject({
        code: 'BOOKING_NOT_PAYABLE',
        status: HttpStatus.BAD_REQUEST,
      });
      expect(prisma.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: BookingStatus.EXPIRED },
        }),
      );
    });
  });

  describe('Payment Execution & Retries', () => {
    beforeEach(() => {
      prisma.paymentAttempt.findUnique.mockResolvedValue(null);
      prisma.booking.findUnique.mockResolvedValue(mockBooking);
      prisma.$queryRaw.mockResolvedValue([{ id: mockBooking.id, status: BookingStatus.PENDING }]);
    });

    it('should process payment successfully and transition booking to CONFIRMED', async () => {
      const createdPayment = {
        id: 'payment-1',
        bookingId: mockBooking.id,
        transactionReference: 'TXN-1',
        idempotencyKey: 'IDEMP-1',
        amountCents: mockBooking.totalAmountCents,
        currency: 'INR',
        status: PaymentStatus.PENDING,
        gatewayProvider: 'MOCK',
        paymentMethod: 'CARD',
        attempts: [],
      };

      const createdAttempt = {
        id: 'attempt-1',
        paymentId: createdPayment.id,
        bookingId: mockBooking.id,
        attemptNumber: 1,
        idempotencyKey: 'IDEMP-1',
        amountCents: mockBooking.totalAmountCents,
        currency: 'INR',
        status: PaymentAttemptStatus.PROCESSING,
        gatewayProvider: 'MOCK',
      };

      prisma.payment.findUnique.mockResolvedValue(null);
      prisma.payment.create.mockResolvedValue(createdPayment);
      prisma.paymentAttempt.create.mockResolvedValue(createdAttempt);

      prisma.paymentAttempt.update.mockResolvedValue({
        ...createdAttempt,
        status: PaymentAttemptStatus.SUCCEEDED,
        gatewayReference: 'MOCK-REF-1',
      });

      prisma.payment.update.mockResolvedValue({
        ...createdPayment,
        status: PaymentStatus.SUCCEEDED,
        settledAt: new Date(),
        booking: { bookingReference: mockBooking.bookingReference },
        attempts: [
          {
            ...createdAttempt,
            status: PaymentAttemptStatus.SUCCEEDED,
            gatewayReference: 'MOCK-REF-1',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        createdAt: new Date(),
      });

      const res = await service.processPayment(
        mockCustomerUser,
        { bookingId: mockBooking.id, paymentMethod: 'CARD' },
        'IDEMP-1',
      );

      expect(res.status).toBe(PaymentStatus.SUCCEEDED);
      expect(res.amount).toBe('13500.00');
      expect(res.attempts.length).toBe(1);
      expect(res.attempts[0].status).toBe(PaymentAttemptStatus.SUCCEEDED);
      expect(prisma.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: BookingStatus.CONFIRMED },
        }),
      );
    });

    it('should record failed payment attempt, keep booking PENDING, and allow retry', async () => {
      // 1. Initial attempt fails
      const createdPayment = {
        id: 'payment-1',
        bookingId: mockBooking.id,
        transactionReference: 'TXN-1',
        idempotencyKey: 'IDEMP-FAIL-1',
        amountCents: mockBooking.totalAmountCents,
        currency: 'INR',
        status: PaymentStatus.PENDING,
        gatewayProvider: 'MOCK',
        paymentMethod: 'CARD',
        attempts: [],
      };

      const createdAttempt = {
        id: 'attempt-1',
        paymentId: createdPayment.id,
        bookingId: mockBooking.id,
        attemptNumber: 1,
        idempotencyKey: 'IDEMP-FAIL-1',
        amountCents: mockBooking.totalAmountCents,
        currency: 'INR',
        status: PaymentAttemptStatus.PROCESSING,
        gatewayProvider: 'MOCK',
      };

      prisma.payment.findUnique.mockResolvedValue(null);
      prisma.payment.create.mockResolvedValue(createdPayment);
      prisma.paymentAttempt.create.mockResolvedValue(createdAttempt);

      prisma.paymentAttempt.update.mockResolvedValue({
        ...createdAttempt,
        status: PaymentAttemptStatus.FAILED,
        failureReason: 'Card declined: Insufficient funds',
      });

      prisma.payment.update.mockResolvedValue({
        ...createdPayment,
        status: PaymentStatus.FAILED,
        failureReason: 'Card declined: Insufficient funds',
        booking: { bookingReference: mockBooking.bookingReference },
        attempts: [
          {
            ...createdAttempt,
            status: PaymentAttemptStatus.FAILED,
            failureReason: 'Card declined: Insufficient funds',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        createdAt: new Date(),
      });

      const failedRes = await service.processPayment(
        mockCustomerUser,
        {
          bookingId: mockBooking.id,
          simulateResult: 'FAILED',
          simulateFailureReason: 'Card declined: Insufficient funds',
        },
        'IDEMP-FAIL-1',
      );

      expect(failedRes.status).toBe(PaymentStatus.FAILED);
      expect(failedRes.attempts[0].status).toBe(PaymentAttemptStatus.FAILED);
      // Booking should NOT be confirmed on failure
      expect(prisma.booking.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: BookingStatus.CONFIRMED } }),
      );

      // 2. Retry with Attempt 2 -> SUCCESS
      const existingPaymentWithAttempt1 = {
        ...createdPayment,
        status: PaymentStatus.FAILED,
        attempts: [failedRes.attempts[0]],
      };

      prisma.payment.findUnique.mockResolvedValue(existingPaymentWithAttempt1);
      prisma.paymentAttempt.create.mockResolvedValue({
        id: 'attempt-2',
        paymentId: createdPayment.id,
        bookingId: mockBooking.id,
        attemptNumber: 2,
        idempotencyKey: 'IDEMP-RETRY-2',
        amountCents: mockBooking.totalAmountCents,
        currency: 'INR',
        status: PaymentAttemptStatus.PROCESSING,
        gatewayProvider: 'MOCK',
      });

      prisma.payment.update.mockResolvedValue({
        ...createdPayment,
        status: PaymentStatus.SUCCEEDED,
        settledAt: new Date(),
        booking: { bookingReference: mockBooking.bookingReference },
        attempts: [
          { ...failedRes.attempts[0], status: PaymentAttemptStatus.FAILED },
          {
            id: 'attempt-2',
            attemptNumber: 2,
            idempotencyKey: 'IDEMP-RETRY-2',
            amountCents: mockBooking.totalAmountCents,
            currency: 'INR',
            status: PaymentAttemptStatus.SUCCEEDED,
            gatewayProvider: 'MOCK',
            gatewayReference: 'MOCK-REF-2',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        createdAt: new Date(),
      });

      const retryRes = await service.processPayment(
        mockCustomerUser,
        { bookingId: mockBooking.id, simulateResult: 'SUCCESS' },
        'IDEMP-RETRY-2',
      );

      expect(retryRes.status).toBe(PaymentStatus.SUCCEEDED);
      expect(retryRes.attempts.length).toBe(2);
      expect(retryRes.attempts[0].status).toBe(PaymentAttemptStatus.FAILED);
      expect(retryRes.attempts[1].status).toBe(PaymentAttemptStatus.SUCCEEDED);
      expect(prisma.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: BookingStatus.CONFIRMED } }),
      );
    });
  });

  describe('Authorization Rules', () => {
    it('should forbid managers from accessing payment details', async () => {
      await expect(
        service.getPaymentById(mockManagerUser, 'payment-1'),
      ).rejects.toMatchObject({
        code: 'FORBIDDEN_RESOURCE',
        status: HttpStatus.FORBIDDEN,
      });
    });

    it('should forbid customers from viewing another user payment', async () => {
      prisma.payment.findUnique.mockResolvedValue({
        id: 'payment-1',
        booking: { customerId: mockCustomerUser.id },
      });

      await expect(
        service.getPaymentById(mockOtherCustomerUser, 'payment-1'),
      ).rejects.toMatchObject({
        code: 'FORBIDDEN_RESOURCE',
        status: HttpStatus.FORBIDDEN,
      });
    });

    it('should allow admin to view any payment', async () => {
      const mockPay = {
        id: 'payment-1',
        bookingId: mockBooking.id,
        transactionReference: 'TXN-1',
        amountCents: BigInt(1350000),
        currency: 'INR',
        status: PaymentStatus.SUCCEEDED,
        gatewayProvider: 'MOCK',
        createdAt: new Date(),
        booking: { customerId: mockCustomerUser.id, bookingReference: 'STY-001' },
        attempts: [],
      };
      prisma.payment.findUnique.mockResolvedValue(mockPay);

      const res = await service.getPaymentById(mockAdminUser, 'payment-1');
      expect(res.id).toBe('payment-1');
    });
  });
});
