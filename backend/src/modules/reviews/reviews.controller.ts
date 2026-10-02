import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { QueryReviewsDto } from './dto/query-reviews.dto';
import { ModerateReviewDto } from './dto/moderate-review.dto';
import {
  ReviewResponse,
  PaginatedReviewsResponse,
  ReviewEligibilityResponse,
} from './types/review-response.type';
import {
  JwtAuthGuard,
  RolesGuard,
  Roles,
  CurrentUser,
} from '../../common';
import { UserRole } from '../auth/types/user-role.enum';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';

@ApiTags('Reviews & Ratings')
@Controller()
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  // ===========================================================================
  // 1. Customer Review Submission & Management
  // ===========================================================================

  @Post('reviews')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER)
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Submit Hotel Stay Review',
    description:
      'Creates a verified review for a legitimate, completed reservation. ' +
      'Guarantees booking ownership, completed stay lifecycle status, and database-level one-review-per-booking uniqueness. ' +
      'Authoritative customer ID and hotel ID are derived strictly server-side.',
  })
  @ApiResponse({
    status: 201,
    description: 'Review created successfully.',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed or reservation is not yet in completed/checked-out status.',
  })
  @ApiResponse({
    status: 403,
    description: 'Customer does not own this reservation record.',
  })
  @ApiResponse({
    status: 404,
    description: 'Reservation record not found.',
  })
  @ApiResponse({
    status: 409,
    description: 'A review has already been submitted for this reservation (one-review-per-booking invariant).',
  })
  async createReview(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateReviewDto,
  ): Promise<ReviewResponse> {
    return this.reviewsService.createReview(user, dto);
  }

  @Patch('reviews/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Update Review Content',
    description:
      'Updates the rating, title, or comment of an existing review. ' +
      'Strictly verifies customer ownership (or admin privileges). ' +
      'Entity relationship links (customerId, bookingId, hotelId) remain strictly immutable.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID of the review to update',
    example: '8b9c1d2e-3f4a-5b6c-7d8e-9f0a1b2c3d4e',
  })
  @ApiResponse({
    status: 200,
    description: 'Review updated successfully.',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid rating or comment payload.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden. You do not own this review.',
  })
  @ApiResponse({
    status: 404,
    description: 'Review record not found.',
  })
  async updateReview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReviewDto,
  ): Promise<ReviewResponse> {
    return this.reviewsService.updateReview(user, id, dto);
  }

  @Delete('reviews/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Delete Review',
    description:
      'Permanently deletes a review. Allowed for the review author (customer) or system administrators. ' +
      'Hotel rating aggregation updates dynamically on deletion.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID of the review to delete',
    example: '8b9c1d2e-3f4a-5b6c-7d8e-9f0a1b2c3d4e',
  })
  @ApiResponse({
    status: 200,
    description: 'Review deleted successfully.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden. You do not have permission to delete this review.',
  })
  @ApiResponse({
    status: 404,
    description: 'Review record not found.',
  })
  async deleteReview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ success: boolean; message: string }> {
    return this.reviewsService.deleteReview(user, id);
  }

  @Get('reviews/me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Customer Review History',
    description:
      'Retrieves all reviews written by the currently authenticated customer with database-level pagination and sorting.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of customer reviews.',
  })
  async getMyReviews(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryReviewsDto,
  ): Promise<PaginatedReviewsResponse> {
    return this.reviewsService.getCustomerReviews(user.id, query);
  }

  // ===========================================================================
  // 2. Pre-flight Review Eligibility Check
  // ===========================================================================

  @Get('bookings/:bookingId/review-eligibility')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Check Reservation Review Eligibility',
    description:
      'Pre-flight convenience query informing frontends whether a given reservation is eligible for review submission. ' +
      'Checks customer ownership, completed stay status, and presence of existing review.',
  })
  @ApiParam({
    name: 'bookingId',
    description: 'UUID of the reservation',
    example: '8b9c1d2e-3f4a-5b6c-7d8e-9f0a1b2c3d4e',
  })
  @ApiResponse({
    status: 200,
    description: 'Eligibility assessment details.',
  })
  async checkEligibility(
    @CurrentUser() user: AuthenticatedUser,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
  ): Promise<ReviewEligibilityResponse> {
    return this.reviewsService.checkReviewEligibility(user, bookingId);
  }

  // ===========================================================================
  // 3. Public Hotel Reviews Discovery & Aggregation
  // ===========================================================================

  @Get('hotels/:hotelId/reviews')
  @ApiOperation({
    summary: 'Public Hotel Reviews & Rating Summary',
    description:
      'Public endpoint returning published reviews for an active hotel. ' +
      'Includes database-computed rating statistics (average rating, review count, rating distribution) ' +
      'and privacy-safe reviewer representation.',
  })
  @ApiParam({
    name: 'hotelId',
    description: 'UUID of the hotel property',
    example: '8b9c1d2e-3f4a-5b6c-7d8e-9f0a1b2c3d4e',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated reviews with rating aggregation statistics.',
  })
  @ApiResponse({
    status: 404,
    description: 'Hotel property not found or inactive.',
  })
  async getHotelReviews(
    @Param('hotelId', ParseUUIDPipe) hotelId: string,
    @Query() query: QueryReviewsDto,
  ): Promise<PaginatedReviewsResponse> {
    return this.reviewsService.getHotelReviews(hotelId, query);
  }

  // ===========================================================================
  // 4. Manager Portal Hotel Reviews
  // ===========================================================================

  @Get('manager/hotels/:hotelId/reviews')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HOTEL_MANAGER, UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Manager Hotel Reviews',
    description:
      'Enables hotel managers to view reviews for properties they are assigned to manage. ' +
      'Enforces manager hotel assignment isolation via HotelAuthorizationService.',
  })
  @ApiParam({
    name: 'hotelId',
    description: 'UUID of the hotel property',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated reviews for manager property.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden. Manager is not assigned to this hotel property.',
  })
  async getManagerHotelReviews(
    @CurrentUser() user: AuthenticatedUser,
    @Param('hotelId', ParseUUIDPipe) hotelId: string,
    @Query() query: QueryReviewsDto,
  ): Promise<PaginatedReviewsResponse> {
    return this.reviewsService.getManagerHotelReviews(user, hotelId, query);
  }

  // ===========================================================================
  // 5. Admin Moderation
  // ===========================================================================

  @Patch('admin/reviews/:id/moderation')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Moderate Review Publication State',
    description:
      'Administrative endpoint to publish or conceal a review for content moderation purposes.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID of the review to moderate',
  })
  @ApiResponse({
    status: 200,
    description: 'Review publication state updated.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden. Admin privileges required.',
  })
  @ApiResponse({
    status: 404,
    description: 'Review record not found.',
  })
  async moderateReview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ModerateReviewDto,
  ): Promise<ReviewResponse> {
    return this.reviewsService.moderateReview(user, id, dto.isPublished);
  }
}
