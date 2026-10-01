import { Injectable, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DomainException } from '../../common/exceptions/domain.exception';
import { HotelAuthorizationService } from '../hotels/authorization/hotel-authorization.service';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { UserRole } from '../auth/types/user-role.enum';
import { BookingStatus } from '../bookings/types/booking-status.enum';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { QueryReviewsDto } from './dto/query-reviews.dto';
import {
  ReviewResponse,
  PaginatedReviewsResponse,
  ReviewEligibilityResponse,
  ReviewRatingSummary,
  RatingDistribution,
} from './types/review-response.type';

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly hotelAuthorizationService: HotelAuthorizationService,
  ) {}

  /**
   * Creates a verified review for a legitimate, completed hotel stay.
   * Enforces customer ownership, stay completion, and strict database uniqueness.
   */
  async createReview(
    user: AuthenticatedUser,
    dto: CreateReviewDto,
  ): Promise<ReviewResponse> {
    // 1. Fetch reservation
    const booking = await this.prisma.booking.findUnique({
      where: { id: dto.bookingId },
      include: {
        hotel: { select: { id: true, name: true, deletedAt: true, isActive: true } },
      },
    });

    if (!booking) {
      throw new DomainException(
        'BOOKING_NOT_FOUND',
        'Reservation record not found.',
        HttpStatus.NOT_FOUND,
      );
    }

    // 2. Customer ownership verification (IDOR & Fake Review Defense)
    if (booking.customerId !== user.id) {
      throw new DomainException(
        'BOOKING_NOT_OWNED',
        'You do not have permission to review another customer reservation.',
        HttpStatus.FORBIDDEN,
      );
    }

    // 3. Stay completion verification (Eligibility Rule)
    const isCompleted =
      booking.status === BookingStatus.CHECKED_OUT ||
      booking.status === 'COMPLETED';

    if (!isCompleted) {
      throw new DomainException(
        'BOOKING_NOT_COMPLETED',
        `Only completed reservations can be reviewed. Current reservation status: ${booking.status}.`,
        HttpStatus.BAD_REQUEST,
      );
    }

    // 4. One-Review-Per-Booking Check
    const existing = await this.prisma.review.findUnique({
      where: { bookingId: dto.bookingId },
    });

    if (existing) {
      throw new DomainException(
        'REVIEW_ALREADY_EXISTS',
        'A review has already been submitted for this reservation.',
        HttpStatus.CONFLICT,
      );
    }

    // 5. Create Review with database constraint race-condition defense (P2002)
    try {
      const review = await this.prisma.review.create({
        data: {
          bookingId: dto.bookingId,
          customerId: user.id,
          hotelId: booking.hotelId,
          rating: dto.rating,
          title: dto.title?.trim() || null,
          comment: dto.comment.trim(),
          isPublished: true,
        },
        include: {
          customer: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      });

      this.logger.log(
        `[ReviewsService] Review ${review.id} created for hotel ${booking.hotelId} by user ${user.id}`,
      );

      return this.mapToReviewResponse(review);
    } catch (error: any) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new DomainException(
          'REVIEW_ALREADY_EXISTS',
          'A review has already been submitted for this reservation.',
          HttpStatus.CONFLICT,
        );
      }
      throw error;
    }
  }

  /**
   * Updates an existing review (rating, title, comment).
   * Strictly enforces customer ownership; relationship links remain immutable.
   */
  async updateReview(
    user: AuthenticatedUser,
    reviewId: string,
    dto: UpdateReviewDto,
  ): Promise<ReviewResponse> {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      include: {
        customer: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (!review) {
      throw new DomainException(
        'REVIEW_NOT_FOUND',
        'Review record not found.',
        HttpStatus.NOT_FOUND,
      );
    }

    // Ownership verification
    if (user.role !== UserRole.ADMIN && review.customerId !== user.id) {
      throw new DomainException(
        'FORBIDDEN_RESOURCE',
        'You do not have permission to modify this review.',
        HttpStatus.FORBIDDEN,
      );
    }

    const updateData: Prisma.ReviewUpdateInput = {};
    if (dto.rating !== undefined) updateData.rating = dto.rating;
    if (dto.title !== undefined) updateData.title = dto.title ? dto.title.trim() : null;
    if (dto.comment !== undefined) updateData.comment = dto.comment.trim();

    const updated = await this.prisma.review.update({
      where: { id: reviewId },
      data: updateData,
      include: {
        customer: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    this.logger.log(`[ReviewsService] Review ${reviewId} updated by user ${user.id}`);
    return this.mapToReviewResponse(updated);
  }

  /**
   * Deletes a review.
   * Permitted for the review author (customer) or system administrators.
   */
  async deleteReview(
    user: AuthenticatedUser,
    reviewId: string,
  ): Promise<{ success: boolean; message: string }> {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new DomainException(
        'REVIEW_NOT_FOUND',
        'Review record not found.',
        HttpStatus.NOT_FOUND,
      );
    }

    // Authorization
    if (user.role !== UserRole.ADMIN && review.customerId !== user.id) {
      throw new DomainException(
        'FORBIDDEN_RESOURCE',
        'You do not have permission to delete this review.',
        HttpStatus.FORBIDDEN,
      );
    }

    await this.prisma.review.delete({
      where: { id: reviewId },
    });

    this.logger.log(`[ReviewsService] Review ${reviewId} deleted by user ${user.id}`);
    return { success: true, message: 'Review deleted successfully.' };
  }

  /**
   * Public discovery endpoint: Retrieves published reviews and rating statistics for a hotel.
   * Uses database-level aggregation (AVG, COUNT, GROUP BY) and pagination.
   */
  async getHotelReviews(
    hotelId: string,
    query: QueryReviewsDto,
  ): Promise<PaginatedReviewsResponse> {
    // 1. Verify hotel exists and is active
    const hotel = await this.prisma.hotel.findFirst({
      where: { id: hotelId, deletedAt: null },
      select: { id: true, isActive: true },
    });

    if (!hotel) {
      throw new DomainException(
        'HOTEL_NOT_FOUND',
        'Hotel property not found.',
        HttpStatus.NOT_FOUND,
      );
    }

    // 2. Query filter
    const where: Prisma.ReviewWhereInput = {
      hotelId,
      isPublished: true,
    };

    if (query.rating) {
      where.rating = query.rating;
    }

    // 3. Database aggregation and total count
    const [total, aggregateResult, groupResult] = await Promise.all([
      this.prisma.review.count({ where }),
      this.prisma.review.aggregate({
        where: { hotelId, isPublished: true },
        _avg: { rating: true },
        _count: { _all: true },
      }),
      this.prisma.review.groupBy({
        by: ['rating'],
        where: { hotelId, isPublished: true },
        _count: { _all: true },
      }),
    ]);

    // Build distribution
    const ratingDistribution: RatingDistribution = {
      '1': 0,
      '2': 0,
      '3': 0,
      '4': 0,
      '5': 0,
    };
    for (const g of groupResult) {
      if (g.rating >= 1 && g.rating <= 5) {
        ratingDistribution[g.rating.toString() as '1' | '2' | '3' | '4' | '5'] =
          g._count._all;
      }
    }

    const rawAvg = aggregateResult._avg.rating ?? 0;
    const summary: ReviewRatingSummary = {
      averageRating: Math.round(rawAvg * 10) / 10,
      reviewCount: aggregateResult._count._all,
      ratingDistribution,
    };

    // 4. Sorting allowlist
    let orderBy: Prisma.ReviewOrderByWithRelationInput;
    switch (query.sortBy) {
      case 'oldest':
        orderBy = { createdAt: 'asc' };
        break;
      case 'highest':
      case 'highest_rating':
        orderBy = { rating: 'desc' };
        break;
      case 'lowest':
      case 'lowest_rating':
        orderBy = { rating: 'asc' };
        break;
      case 'newest':
      default:
        orderBy = { createdAt: 'desc' };
        break;
    }

    // 5. Database Pagination
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const items = await this.prisma.review.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      include: {
        customer: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return {
      items: items.map((r) => this.mapToReviewResponse(r)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
      summary,
    };
  }

  /**
   * Retrieves all reviews written by the authenticated customer.
   */
  async getCustomerReviews(
    customerId: string,
    query: QueryReviewsDto,
  ): Promise<PaginatedReviewsResponse> {
    const where: Prisma.ReviewWhereInput = { customerId };

    const total = await this.prisma.review.count({ where });

    let orderBy: Prisma.ReviewOrderByWithRelationInput;
    switch (query.sortBy) {
      case 'oldest':
        orderBy = { createdAt: 'asc' };
        break;
      case 'highest':
      case 'highest_rating':
        orderBy = { rating: 'desc' };
        break;
      case 'lowest':
      case 'lowest_rating':
        orderBy = { rating: 'asc' };
        break;
      case 'newest':
      default:
        orderBy = { createdAt: 'desc' };
        break;
    }

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const items = await this.prisma.review.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      include: {
        customer: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return {
      items: items.map((r) => this.mapToReviewResponse(r)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Manager access: Reviews for a specific managed hotel property.
   * Enforces manager hotel property assignment.
   */
  async getManagerHotelReviews(
    user: AuthenticatedUser,
    hotelId: string,
    query: QueryReviewsDto,
  ): Promise<PaginatedReviewsResponse> {
    if (
      user.role === UserRole.HOTEL_MANAGER ||
      user.role === 'MANAGER'
    ) {
      await this.hotelAuthorizationService.assertManagerAccess(
        user.id,
        hotelId,
        { hideExistence: true },
      );
    } else if (user.role !== UserRole.ADMIN) {
      throw new DomainException(
        'FORBIDDEN',
        'You do not have permission to view manager reviews for this hotel.',
        HttpStatus.FORBIDDEN,
      );
    }

    return this.getHotelReviews(hotelId, query);
  }

  /**
   * Checks whether the authenticated customer is eligible to submit a review for a booking.
   */
  async checkReviewEligibility(
    user: AuthenticatedUser,
    bookingId: string,
  ): Promise<ReviewEligibilityResponse> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      return {
        eligible: false,
        bookingId,
        reason: 'BOOKING_NOT_FOUND',
      };
    }

    if (booking.customerId !== user.id) {
      return {
        eligible: false,
        bookingId,
        reason: 'BOOKING_NOT_OWNED',
      };
    }

    const isCompleted =
      booking.status === BookingStatus.CHECKED_OUT ||
      booking.status === 'COMPLETED';

    if (!isCompleted) {
      return {
        eligible: false,
        bookingId,
        reason: 'BOOKING_NOT_COMPLETED',
      };
    }

    const existing = await this.prisma.review.findUnique({
      where: { bookingId },
    });

    if (existing) {
      return {
        eligible: false,
        bookingId,
        reason: 'REVIEW_ALREADY_EXISTS',
      };
    }

    return {
      eligible: true,
      bookingId,
      reason: null,
    };
  }

  /**
   * Administrative review moderation (hide or publish).
   */
  async moderateReview(
    user: AuthenticatedUser,
    reviewId: string,
    isPublished: boolean,
  ): Promise<ReviewResponse> {
    if (user.role !== UserRole.ADMIN) {
      throw new DomainException(
        'FORBIDDEN',
        'Only administrators may moderate customer reviews.',
        HttpStatus.FORBIDDEN,
      );
    }

    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new DomainException(
        'REVIEW_NOT_FOUND',
        'Review record not found.',
        HttpStatus.NOT_FOUND,
      );
    }

    const updated = await this.prisma.review.update({
      where: { id: reviewId },
      data: { isPublished },
      include: {
        customer: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    this.logger.log(
      `[ReviewsService] Review ${reviewId} publication state set to ${isPublished} by admin ${user.id}`,
    );

    return this.mapToReviewResponse(updated);
  }

  /**
   * Privacy-safe mapper from raw database Review record to client-facing ReviewResponse DTO.
   * Conceals customer passwords, email, phone, and internal database audit metadata.
   */
  private mapToReviewResponse(review: any): ReviewResponse {
    let displayName = 'Guest';
    if (review.customer) {
      const first = review.customer.firstName || '';
      const last = review.customer.lastName || '';
      if (first && last) {
        displayName = `${first} ${last.charAt(0)}.`;
      } else if (first) {
        displayName = first;
      }
    }

    return {
      id: review.id,
      bookingId: review.bookingId,
      hotelId: review.hotelId,
      rating: review.rating,
      title: review.title || null,
      comment: review.comment,
      isPublished: review.isPublished,
      createdAt: review.createdAt.toISOString(),
      updatedAt: review.updatedAt.toISOString(),
      reviewer: {
        id: review.customer?.id || review.customerId,
        displayName,
      },
    };
  }
}
