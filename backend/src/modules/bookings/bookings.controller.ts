import {
  Controller,
  Get,
  Post,
  Patch,
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
} from '@nestjs/swagger';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { QueryBookingsDto } from './dto/query-bookings.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';
import {
  JwtAuthGuard,
  RolesGuard,
  Roles,
  CurrentUser,
} from '../../common';
import { UserRole } from '../auth/types/user-role.enum';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';

@ApiTags('Reservations & Booking Engine')
@ApiBearerAuth('JWT-auth')
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create Reservation & Allocate Inventory',
    description:
      'Creates a new booking for the authenticated customer. ' +
      'Re-checks availability inside a transaction, pessimistically locks physical rooms, ' +
      'prevents concurrent double-booking, and persists price snapshots. ' +
      'Initial status is PENDING with a 15-minute temporary inventory hold window.',
  })
  @ApiResponse({
    status: 201,
    description: 'Booking created and physical inventory allocated successfully.',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error, invalid dates, or hotel/room category mismatch.',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized: Missing or invalid customer JWT.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden: Non-customer role attempting to create reservation.',
  })
  @ApiResponse({
    status: 404,
    description: 'Hotel property or RoomType not found.',
  })
  @ApiResponse({
    status: 409,
    description:
      'ROOM_NOT_AVAILABLE: The requested room category does not have enough available physical rooms for the specified dates.',
  })
  async createBooking(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateBookingDto,
  ) {
    return this.bookingsService.createBooking(user.id, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER, UserRole.HOTEL_MANAGER, UserRole.ADMIN)
  @ApiOperation({
    summary: 'List Bookings (Role-Scoped)',
    description:
      'Retrieves paginated bookings filtered by role: ' +
      'Customers receive only their personal reservations; ' +
      'Hotel Managers receive reservations for their assigned properties; ' +
      'Administrators receive platform-wide reservations.',
  })
  @ApiResponse({ status: 200, description: 'Bookings retrieved successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized: Missing or invalid token.' })
  @ApiResponse({ status: 403, description: 'Forbidden: Access to unassigned property denied.' })
  async getBookings(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryBookingsDto,
  ) {
    if (user.role === UserRole.CUSTOMER) {
      return this.bookingsService.findCustomerBookings(user.id, query);
    }

    if (
      user.role === UserRole.HOTEL_MANAGER ||
      user.role === 'MANAGER'
    ) {
      return this.bookingsService.findManagerBookings(user.id, query);
    }

    return this.bookingsService.findAllBookings(query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER, UserRole.HOTEL_MANAGER, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get Booking Details by ID',
    description:
      'Retrieves complete booking details with physical room allocations and price snapshot. ' +
      'Strictly enforces customer ownership and manager property assignments (IDOR defense).',
  })
  @ApiParam({ name: 'id', description: 'Booking UUID' })
  @ApiResponse({ status: 200, description: 'Booking details retrieved successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized: Missing or invalid token.' })
  @ApiResponse({ status: 404, description: 'Booking not found or access denied.' })
  async getBookingById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.bookingsService.findBookingById(user, id);
  }

  @Patch(':id/cancel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER, UserRole.HOTEL_MANAGER, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Cancel Reservation',
    description:
      'Cancels an active reservation (PENDING or CONFIRMED), transitions booking status to CANCELLED, ' +
      'and atomically releases allocated physical rooms back to the available inventory pool.',
  })
  @ApiParam({ name: 'id', description: 'Booking UUID' })
  @ApiResponse({ status: 200, description: 'Reservation cancelled and inventory released.' })
  @ApiResponse({ status: 400, description: 'Invalid state transition or already cancelled.' })
  @ApiResponse({ status: 401, description: 'Unauthorized: Missing or invalid token.' })
  @ApiResponse({ status: 404, description: 'Booking not found or access denied.' })
  async cancelBooking(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelBookingDto,
  ) {
    return this.bookingsService.cancelBooking(user, id, dto);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HOTEL_MANAGER, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Update Reservation Lifecycle Status',
    description:
      'Advances reservation state according to the domain state machine: ' +
      'PENDING -> CONFIRMED; CONFIRMED -> CHECKED_IN; CHECKED_IN -> CHECKED_OUT. ' +
      'Synchronizes physical room allocation statuses.',
  })
  @ApiParam({ name: 'id', description: 'Booking UUID' })
  @ApiResponse({ status: 200, description: 'Reservation status updated successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid state machine transition.' })
  @ApiResponse({ status: 401, description: 'Unauthorized: Missing or invalid token.' })
  @ApiResponse({ status: 403, description: 'Forbidden: Caller not assigned to property.' })
  @ApiResponse({ status: 404, description: 'Booking not found.' })
  async updateBookingStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBookingStatusDto,
  ) {
    return this.bookingsService.updateBookingStatus(user, id, dto.status);
  }
}
