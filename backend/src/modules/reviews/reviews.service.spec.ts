import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ReviewsService } from './reviews.service';
import { PrismaService } from '../../prisma/prisma.service';
import { HotelAuthorizationService } from '../hotels/authorization/hotel-authorization.service';
import { DomainException } from '../../common/exceptions/domain.exception';
import { BookingStatus } from '../bookings/types/booking-status.enum';
import { UserRole } from '../auth/types/user-role.enum';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { NotificationsService } from '../notifications/notifications.service';

describe('ReviewsService Unit Tests', () => {
  let service: ReviewsService;
  let prisma: any;
  let hotelAuthService: any;

  const mockCustomerId = '11111111-1111-4111-8111-111111111111';
  const mockOtherCustomerId = '22222222-2222-4222-8222-222222222222';
  const mockHotelId = '33333333-3333-4333-8333-333333333333';
  const mockBookingId = '44444444-4444-4444-8444-444444444444';
  const mockReviewId = '55555555-5555-4555-8555-555555555555';

  const mockCustomerUser: AuthenticatedUser = {
    id: mockCustomerId,
    email: 'customer@example.com',
    role: UserRole.CUSTOMER,
  };

  const mockOtherUser: AuthenticatedUser = {
    id: mockOtherCustomerId,
    email: 'other@example.com',
    role: UserRole.CUSTOMER,
  };

  const mockAdminUser: AuthenticatedUser = {
    id: '99999999-9999-4999-8999-999999999999',
    email: 'admin@stayora.com',
    role: UserRole.ADMIN,
  };

  const mockManagerUser: AuthenticatedUser = {
    id: '88888888-8888-4888-8888-888888888888',
    email: 'manager@stayora.com',
    role: UserRole.HOTEL_MANAGER,
  };

  const mockBookingRecord = {
    id: mockBookingId,
    customerId: mockCustomerId,
    hotelId: mockHotelId,
    status: BookingStatus.CHECKED_OUT,
    hotel: {
      id: mockHotelId,
      name: 'Grand Seaside Resort',
      deletedAt: null,
      isActive: true,
    },
  };

  const mockReviewRecord = {
    id: mockReviewId,
    bookingId: mockBookingId,
    customerId: mockCustomerId,
    hotelId: mockHotelId,
    rating: 5,
    title: 'Outstanding hospitality',
    comment: 'Exceptional service and pristine ocean view room.',
    isPublished: true,
    createdAt: new Date('2026-10-01T10:00:00.000Z'),
    updatedAt: new Date('2026-10-01T10:00:00.000Z'),
    customer: {
      id: mockCustomerId,
      firstName: 'Aarav',
      lastName: 'Sharma',
    },
  };

  beforeEach(async () => {
    prisma = {
      booking: {
        findUnique: jest.fn(),
      },
      review: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        aggregate: jest.fn(),
        groupBy: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      hotel: {
        findFirst: jest.fn(),
      },
    };

    hotelAuthService = {
      assertManagerAccess: jest.fn(),
    };

    const notificationsService = {
      create: jest.fn().mockResolvedValue({ id: 'mock-notif-id' }),
      createForManagersOfHotel: jest.fn().mockResolvedValue(1),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewsService,
        { provide: PrismaService, useValue: prisma },
        { provide: HotelAuthorizationService, useValue: hotelAuthService },
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    service = module.get<ReviewsService>(ReviewsService);
  });

  describe('createReview()', () => {
    it('successfully creates a review for a completed stay owned by customer', async () => {
      prisma.booking.findUnique.mockResolvedValue(mockBookingRecord);
      prisma.review.findUnique.mockResolvedValue(null);
      prisma.review.create.mockResolvedValue(mockReviewRecord);

      const result = await service.createReview(mockCustomerUser, {
        bookingId: mockBookingId,
        rating: 5,
        title: 'Outstanding hospitality',
        comment: 'Exceptional service and pristine ocean view room.',
      });

      expect(result).toBeDefined();
      expect(result.id).toBe(mockReviewId);
      expect(result.rating).toBe(5);
      expect(result.reviewer.displayName).toBe('Aarav S.');
      expect(prisma.review.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            bookingId: mockBookingId,
            customerId: mockCustomerId,
            hotelId: mockHotelId,
            rating: 5,
          }),
        }),
      );
    });

    it('rejects review creation if booking does not exist', async () => {
      prisma.booking.findUnique.mockResolvedValue(null);

      await expect(
        service.createReview(mockCustomerUser, {
          bookingId: mockBookingId,
          rating: 5,
          comment: 'Great stay!',
        }),
      ).rejects.toThrow(DomainException);

      await expect(
        service.createReview(mockCustomerUser, {
          bookingId: mockBookingId,
          rating: 5,
          comment: 'Great stay!',
        }),
      ).rejects.toMatchObject({
        code: 'BOOKING_NOT_FOUND',
        status: HttpStatus.NOT_FOUND,
      });
    });

    it('rejects review creation if booking belongs to a different customer (IDOR protection)', async () => {
      prisma.booking.findUnique.mockResolvedValue({
        ...mockBookingRecord,
        customerId: 'different-customer-uuid',
      });

      await expect(
        service.createReview(mockCustomerUser, {
          bookingId: mockBookingId,
          rating: 5,
          comment: 'Great stay!',
        }),
      ).rejects.toMatchObject({
        code: 'BOOKING_NOT_OWNED',
        status: HttpStatus.FORBIDDEN,
      });
    });

    it('rejects review creation if booking status is not CHECKED_OUT or COMPLETED', async () => {
      const nonCompletedStatuses = [
        BookingStatus.PENDING,
        BookingStatus.CONFIRMED,
        BookingStatus.CHECKED_IN,
        BookingStatus.CANCELLED,
      ];

      for (const status of nonCompletedStatuses) {
        prisma.booking.findUnique.mockResolvedValue({
          ...mockBookingRecord,
          status,
        });

        await expect(
          service.createReview(mockCustomerUser, {
            bookingId: mockBookingId,
            rating: 5,
            comment: 'Great stay!',
          }),
        ).rejects.toMatchObject({
          code: 'BOOKING_NOT_COMPLETED',
          status: HttpStatus.BAD_REQUEST,
        });
      }
    });

    it('rejects duplicate review if one already exists for this booking', async () => {
      prisma.booking.findUnique.mockResolvedValue(mockBookingRecord);
      prisma.review.findUnique.mockResolvedValue(mockReviewRecord);

      await expect(
        service.createReview(mockCustomerUser, {
          bookingId: mockBookingId,
          rating: 5,
          comment: 'Second review attempt',
        }),
      ).rejects.toMatchObject({
        code: 'REVIEW_ALREADY_EXISTS',
        status: HttpStatus.CONFLICT,
      });
    });

    it('handles concurrent race condition via Prisma P2002 unique constraint', async () => {
      prisma.booking.findUnique.mockResolvedValue(mockBookingRecord);
      prisma.review.findUnique.mockResolvedValue(null);

      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed on the fields: (`booking_id`)',
        {
          code: 'P2002',
          clientVersion: '5.x',
        },
      );
      prisma.review.create.mockRejectedValue(prismaError);

      await expect(
        service.createReview(mockCustomerUser, {
          bookingId: mockBookingId,
          rating: 5,
          comment: 'Concurrent attempt',
        }),
      ).rejects.toMatchObject({
        code: 'REVIEW_ALREADY_EXISTS',
        status: HttpStatus.CONFLICT,
      });
    });
  });

  describe('updateReview()', () => {
    it('allows author to update rating, title, and comment', async () => {
      prisma.review.findUnique.mockResolvedValue(mockReviewRecord);
      prisma.review.update.mockResolvedValue({
        ...mockReviewRecord,
        rating: 4,
        title: 'Updated title',
        comment: 'Updated review content.',
      });

      const result = await service.updateReview(mockCustomerUser, mockReviewId, {
        rating: 4,
        title: 'Updated title',
        comment: 'Updated review content.',
      });

      expect(result.rating).toBe(4);
      expect(result.title).toBe('Updated title');
      expect(result.comment).toBe('Updated review content.');
    });

    it('allows admin to update review', async () => {
      prisma.review.findUnique.mockResolvedValue(mockReviewRecord);
      prisma.review.update.mockResolvedValue({
        ...mockReviewRecord,
        comment: 'Moderated review content.',
      });

      const result = await service.updateReview(mockAdminUser, mockReviewId, {
        comment: 'Moderated review content.',
      });

      expect(result.comment).toBe('Moderated review content.');
    });

    it('forbids another customer from modifying author review', async () => {
      prisma.review.findUnique.mockResolvedValue(mockReviewRecord);

      await expect(
        service.updateReview(mockOtherUser, mockReviewId, {
          rating: 1,
        }),
      ).rejects.toMatchObject({
        code: 'FORBIDDEN_RESOURCE',
        status: HttpStatus.FORBIDDEN,
      });
    });

    it('throws 404 if review does not exist', async () => {
      prisma.review.findUnique.mockResolvedValue(null);

      await expect(
        service.updateReview(mockCustomerUser, 'non-existent-id', {
          rating: 4,
        }),
      ).rejects.toMatchObject({
        code: 'REVIEW_NOT_FOUND',
        status: HttpStatus.NOT_FOUND,
      });
    });
  });

  describe('deleteReview()', () => {
    it('allows author to delete review', async () => {
      prisma.review.findUnique.mockResolvedValue(mockReviewRecord);
      prisma.review.delete.mockResolvedValue(mockReviewRecord);

      const result = await service.deleteReview(mockCustomerUser, mockReviewId);
      expect(result.success).toBe(true);
      expect(prisma.review.delete).toHaveBeenCalledWith({
        where: { id: mockReviewId },
      });
    });

    it('allows admin to delete review', async () => {
      prisma.review.findUnique.mockResolvedValue(mockReviewRecord);
      prisma.review.delete.mockResolvedValue(mockReviewRecord);

      const result = await service.deleteReview(mockAdminUser, mockReviewId);
      expect(result.success).toBe(true);
      expect(prisma.review.delete).toHaveBeenCalledWith({
        where: { id: mockReviewId },
      });
    });

    it('forbids another customer from deleting review', async () => {
      prisma.review.findUnique.mockResolvedValue(mockReviewRecord);

      await expect(
        service.deleteReview(mockOtherUser, mockReviewId),
      ).rejects.toMatchObject({
        code: 'FORBIDDEN_RESOURCE',
        status: HttpStatus.FORBIDDEN,
      });
    });
  });

  describe('getHotelReviews() and Aggregation', () => {
    it('returns paginated reviews and aggregated rating summary', async () => {
      prisma.hotel.findFirst.mockResolvedValue({
        id: mockHotelId,
        isActive: true,
      });
      prisma.review.count.mockResolvedValue(5);
      prisma.review.aggregate.mockResolvedValue({
        _avg: { rating: 4.2 },
        _count: { _all: 5 },
      });
      prisma.review.groupBy.mockResolvedValue([
        { rating: 5, _count: { _all: 2 } },
        { rating: 4, _count: { _all: 2 } },
        { rating: 3, _count: { _all: 1 } },
      ]);
      prisma.review.findMany.mockResolvedValue([mockReviewRecord]);

      const result = await service.getHotelReviews(mockHotelId, {
        page: 1,
        limit: 20,
        sortBy: 'newest',
      });

      expect(result.items).toHaveLength(1);
      expect(result.meta.total).toBe(5);
      expect(result.summary).toBeDefined();
      expect(result.summary?.averageRating).toBe(4.2);
      expect(result.summary?.reviewCount).toBe(5);
      expect(result.summary?.ratingDistribution).toEqual({
        '1': 0,
        '2': 0,
        '3': 1,
        '4': 2,
        '5': 2,
      });
    });

    it('throws 404 when hotel does not exist or is inactive', async () => {
      prisma.hotel.findFirst.mockResolvedValue(null);

      await expect(
        service.getHotelReviews('invalid-hotel', {}),
      ).rejects.toMatchObject({
        code: 'HOTEL_NOT_FOUND',
        status: HttpStatus.NOT_FOUND,
      });
    });
  });

  describe('checkReviewEligibility()', () => {
    it('returns eligible: true for completed owned stay without review', async () => {
      prisma.booking.findUnique.mockResolvedValue(mockBookingRecord);
      prisma.review.findUnique.mockResolvedValue(null);

      const result = await service.checkReviewEligibility(
        mockCustomerUser,
        mockBookingId,
      );

      expect(result.eligible).toBe(true);
      expect(result.reason).toBeNull();
    });

    it('returns eligible: false when booking not completed', async () => {
      prisma.booking.findUnique.mockResolvedValue({
        ...mockBookingRecord,
        status: BookingStatus.CONFIRMED,
      });

      const result = await service.checkReviewEligibility(
        mockCustomerUser,
        mockBookingId,
      );

      expect(result.eligible).toBe(false);
      expect(result.reason).toBe('BOOKING_NOT_COMPLETED');
    });

    it('returns eligible: false when review already exists', async () => {
      prisma.booking.findUnique.mockResolvedValue(mockBookingRecord);
      prisma.review.findUnique.mockResolvedValue(mockReviewRecord);

      const result = await service.checkReviewEligibility(
        mockCustomerUser,
        mockBookingId,
      );

      expect(result.eligible).toBe(false);
      expect(result.reason).toBe('REVIEW_ALREADY_EXISTS');
    });
  });

  describe('getManagerHotelReviews()', () => {
    it('verifies manager access through HotelAuthorizationService', async () => {
      hotelAuthService.assertManagerAccess.mockResolvedValue(true);
      prisma.hotel.findFirst.mockResolvedValue({ id: mockHotelId, isActive: true });
      prisma.review.count.mockResolvedValue(0);
      prisma.review.aggregate.mockResolvedValue({
        _avg: { rating: null },
        _count: { _all: 0 },
      });
      prisma.review.groupBy.mockResolvedValue([]);
      prisma.review.findMany.mockResolvedValue([]);

      const result = await service.getManagerHotelReviews(
        mockManagerUser,
        mockHotelId,
        {},
      );

      expect(result).toBeDefined();
      expect(hotelAuthService.assertManagerAccess).toHaveBeenCalledWith(
        mockManagerUser.id,
        mockHotelId,
        { hideExistence: true },
      );
    });
  });

  describe('moderateReview()', () => {
    it('allows admin to set isPublished to false', async () => {
      prisma.review.findUnique.mockResolvedValue(mockReviewRecord);
      prisma.review.update.mockResolvedValue({
        ...mockReviewRecord,
        isPublished: false,
      });

      const result = await service.moderateReview(
        mockAdminUser,
        mockReviewId,
        false,
      );

      expect(result.isPublished).toBe(false);
    });

    it('forbids non-admin user from moderating review', async () => {
      await expect(
        service.moderateReview(mockCustomerUser, mockReviewId, false),
      ).rejects.toMatchObject({
        code: 'FORBIDDEN',
        status: HttpStatus.FORBIDDEN,
      });
    });
  });
});
