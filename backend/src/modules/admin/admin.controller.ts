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
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../auth/types/user-role.enum';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';

import { AdminDashboardQueryDto } from './dto/admin-dashboard-query.dto';
import { AdminQueryUsersDto } from './dto/admin-query-users.dto';
import { AdminUpdateUserStatusDto } from './dto/admin-update-user-status.dto';
import { AdminQueryManagersDto } from './dto/admin-query-managers.dto';
import { AdminAssignManagerDto } from './dto/admin-assign-manager.dto';
import { AdminQueryHotelsDto } from './dto/admin-query-hotels.dto';
import { AdminUpdateHotelStatusDto } from './dto/admin-update-hotel-status.dto';
import { AdminQueryBookingsDto } from './dto/admin-query-bookings.dto';
import { AdminQueryPaymentsDto } from './dto/admin-query-payments.dto';
import { AdminQueryReviewsDto } from './dto/admin-query-reviews.dto';
import { AdminModerateReviewDto } from './dto/admin-moderate-review.dto';
import { AdminQueryNotificationsDto } from './dto/admin-query-notifications.dto';
import { AdminQueryAuditLogsDto } from './dto/admin-query-audit-logs.dto';

@ApiTags('Admin Operations & Platform Management')
@ApiBearerAuth('JWT-auth')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ===========================================================================
  // 1. Dashboard Overview
  // ===========================================================================

  @Get('dashboard')
  @ApiOperation({
    summary: 'Platform Operational Statistics Overview',
    description:
      'Returns authoritative database-aggregated platform statistics across users, hotels, inventory, bookings, revenue, reviews, and notifications.',
  })
  @ApiResponse({ status: 200, description: 'Aggregated dashboard metrics retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthenticated request' })
  @ApiResponse({ status: 403, description: 'Forbidden - requires ADMIN role' })
  async getDashboard(@Query() query: AdminDashboardQueryDto) {
    return this.adminService.getDashboardStats(query);
  }

  // ===========================================================================
  // 2. User Management
  // ===========================================================================

  @Get('users')
  @ApiOperation({
    summary: 'List Platform Users',
    description: 'Returns paginated user list with role, status, and search filters.',
  })
  @ApiResponse({ status: 200, description: 'Paginated user list' })
  async getUsers(@Query() query: AdminQueryUsersDto) {
    return this.adminService.getUsers(query);
  }

  @Get('users/:id')
  @ApiOperation({
    summary: 'Inspect User Account Detail',
    description: 'Returns complete user profile and activity counts.',
  })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'User profile retrieved' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserById(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.adminService.getUserById(id);
  }

  @Patch('users/:id/status')
  @ApiOperation({
    summary: 'Update User Account Status',
    description:
      'Transitions account status (ACTIVE, SUSPENDED, DISABLED). Protected against self-modification.',
  })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'Status updated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden self-modification' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async updateUserStatus(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: AdminUpdateUserStatusDto,
    @CurrentUser() adminUser: AuthenticatedUser,
  ) {
    return this.adminService.updateUserStatus(id, dto, adminUser);
  }

  // ===========================================================================
  // 3. Manager Management & Property Assignments
  // ===========================================================================

  @Get('managers')
  @ApiOperation({
    summary: 'List Hotel Managers',
    description: 'Returns paginated list of managers with assigned properties summary.',
  })
  @ApiResponse({ status: 200, description: 'Paginated manager list' })
  async getManagers(@Query() query: AdminQueryManagersDto) {
    return this.adminService.getManagers(query);
  }

  @Get('managers/:id')
  @ApiOperation({
    summary: 'Inspect Hotel Manager Detail',
    description: 'Returns manager profile and full hotel assignment records.',
  })
  @ApiParam({ name: 'id', description: 'Manager UUID' })
  @ApiResponse({ status: 200, description: 'Manager profile retrieved' })
  @ApiResponse({ status: 404, description: 'Manager not found' })
  async getManagerById(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.adminService.getManagerById(id);
  }

  @Patch('managers/:id/status')
  @ApiOperation({
    summary: 'Update Hotel Manager Status',
    description: 'Updates account status for hotel manager.',
  })
  @ApiParam({ name: 'id', description: 'Manager UUID' })
  @ApiResponse({ status: 200, description: 'Manager status updated' })
  async updateManagerStatus(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: AdminUpdateUserStatusDto,
    @CurrentUser() adminUser: AuthenticatedUser,
  ) {
    return this.adminService.updateUserStatus(id, dto, adminUser);
  }

  @Post('hotels/:hotelId/managers/:managerId')
  @ApiOperation({
    summary: 'Assign Manager to Hotel',
    description: 'Creates or updates manager assignment for a hotel property idempotently.',
  })
  @ApiParam({ name: 'hotelId', description: 'Hotel UUID' })
  @ApiParam({ name: 'managerId', description: 'Manager UUID' })
  @ApiResponse({ status: 200, description: 'Manager assigned successfully' })
  @ApiResponse({ status: 400, description: 'Invalid user role or inactive account' })
  @ApiResponse({ status: 404, description: 'Hotel or manager not found' })
  async assignManager(
    @Param('hotelId', new ParseUUIDPipe({ version: '4' })) hotelId: string,
    @Param('managerId', new ParseUUIDPipe({ version: '4' })) managerId: string,
    @Body() dto: AdminAssignManagerDto,
    @CurrentUser() adminUser: AuthenticatedUser,
  ) {
    return this.adminService.assignManager(hotelId, managerId, dto, adminUser);
  }

  @Delete('hotels/:hotelId/managers/:managerId')
  @ApiOperation({
    summary: 'Unassign Manager from Hotel',
    description: 'Removes manager assignment from hotel property without deleting accounts.',
  })
  @ApiParam({ name: 'hotelId', description: 'Hotel UUID' })
  @ApiParam({ name: 'managerId', description: 'Manager UUID' })
  @ApiResponse({ status: 200, description: 'Manager unassigned successfully' })
  @ApiResponse({ status: 404, description: 'Assignment not found' })
  async unassignManager(
    @Param('hotelId', new ParseUUIDPipe({ version: '4' })) hotelId: string,
    @Param('managerId', new ParseUUIDPipe({ version: '4' })) managerId: string,
    @CurrentUser() adminUser: AuthenticatedUser,
  ) {
    return this.adminService.unassignManager(hotelId, managerId, adminUser);
  }

  // ===========================================================================
  // 4. Hotel Administration
  // ===========================================================================

  @Get('hotels')
  @ApiOperation({
    summary: 'Platform-Wide Hotel Listing',
    description: 'Returns all hotels (both active and inactive) with aggregate inventory counts.',
  })
  @ApiResponse({ status: 200, description: 'Paginated hotel list' })
  async getHotels(@Query() query: AdminQueryHotelsDto) {
    return this.adminService.getHotels(query);
  }

  @Get('hotels/:id')
  @ApiOperation({
    summary: 'Inspect Hotel Detail',
    description: 'Returns complete hotel properties, room types, rooms, and assigned staff.',
  })
  @ApiParam({ name: 'id', description: 'Hotel UUID' })
  @ApiResponse({ status: 200, description: 'Hotel detail retrieved' })
  @ApiResponse({ status: 404, description: 'Hotel not found' })
  async getHotelById(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.adminService.getHotelById(id);
  }

  @Patch('hotels/:id/status')
  @ApiOperation({
    summary: 'Activate or Deactivate Hotel Property',
    description: 'Updates active status safely while preserving existing confirmed reservations.',
  })
  @ApiParam({ name: 'id', description: 'Hotel UUID' })
  @ApiResponse({ status: 200, description: 'Hotel status updated' })
  @ApiResponse({ status: 404, description: 'Hotel not found' })
  async updateHotelStatus(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: AdminUpdateHotelStatusDto,
    @CurrentUser() adminUser: AuthenticatedUser,
  ) {
    return this.adminService.updateHotelStatus(id, dto, adminUser);
  }

  // ===========================================================================
  // 5. Booking Administration
  // ===========================================================================

  @Get('bookings')
  @ApiOperation({
    summary: 'Platform-Wide Booking Inspection',
    description: 'Read-only access to all bookings across all properties.',
  })
  @ApiResponse({ status: 200, description: 'Paginated bookings list' })
  async getBookings(@Query() query: AdminQueryBookingsDto) {
    return this.adminService.getBookings(query);
  }

  @Get('bookings/:id')
  @ApiOperation({
    summary: 'Inspect Single Booking Detail',
    description: 'Returns full reservation ledger, room allocations, guests, payment, and audit history.',
  })
  @ApiParam({ name: 'id', description: 'Booking UUID' })
  @ApiResponse({ status: 200, description: 'Booking detail retrieved' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  async getBookingById(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.adminService.getBookingById(id);
  }

  // ===========================================================================
  // 6. Payment Administration
  // ===========================================================================

  @Get('payments')
  @ApiOperation({
    summary: 'Platform-Wide Payment Ledger Inspection',
    description: 'Read-only access to all payments across all gateways with sanitized payload.',
  })
  @ApiResponse({ status: 200, description: 'Paginated payments list' })
  async getPayments(@Query() query: AdminQueryPaymentsDto) {
    return this.adminService.getPayments(query);
  }

  @Get('payments/:id')
  @ApiOperation({
    summary: 'Inspect Payment Detail',
    description: 'Returns payment transaction, provider attempts, and refund status.',
  })
  @ApiParam({ name: 'id', description: 'Payment UUID' })
  @ApiResponse({ status: 200, description: 'Payment detail retrieved' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async getPaymentById(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.adminService.getPaymentById(id);
  }

  // ===========================================================================
  // 7. Review Moderation
  // ===========================================================================

  @Get('reviews')
  @ApiOperation({
    summary: 'Platform-Wide Review Inspection',
    description: 'Lists all guest reviews with publication status.',
  })
  @ApiResponse({ status: 200, description: 'Paginated reviews list' })
  async getReviews(@Query() query: AdminQueryReviewsDto) {
    return this.adminService.getReviews(query);
  }

  @Get('reviews/:id')
  @ApiOperation({
    summary: 'Inspect Review Detail',
  })
  @ApiParam({ name: 'id', description: 'Review UUID' })
  @ApiResponse({ status: 200, description: 'Review retrieved' })
  @ApiResponse({ status: 404, description: 'Review not found' })
  async getReviewById(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.adminService.getReviewById(id);
  }

  @Patch('reviews/:id/moderation')
  @ApiOperation({
    summary: 'Moderate Review Publication Status',
    description: 'Allows Admin to publish or unpublish a review with operational justification.',
  })
  @ApiParam({ name: 'id', description: 'Review UUID' })
  @ApiResponse({ status: 200, description: 'Review moderated successfully' })
  @ApiResponse({ status: 404, description: 'Review not found' })
  async moderateReview(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: AdminModerateReviewDto,
    @CurrentUser() adminUser: AuthenticatedUser,
  ) {
    return this.adminService.moderateReview(id, dto, adminUser);
  }

  // ===========================================================================
  // 8. Notification Administration
  // ===========================================================================

  @Get('notifications')
  @ApiOperation({
    summary: 'Platform-Wide Notification Inspection',
    description: 'Read-only inspection of dispatched notifications across all accounts.',
  })
  @ApiResponse({ status: 200, description: 'Paginated notification log' })
  async getNotifications(@Query() query: AdminQueryNotificationsDto) {
    return this.adminService.getNotifications(query);
  }

  // ===========================================================================
  // 9. Platform Audit Trail
  // ===========================================================================

  @Get('audit-logs')
  @ApiOperation({
    summary: 'Platform-Wide Audit Trail Inspection',
    description:
      'Retrieves append-only, immutable audit trail records with actor, entity, action, and before/after diff details.',
  })
  @ApiResponse({ status: 200, description: 'Paginated audit logs retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthenticated request' })
  @ApiResponse({ status: 403, description: 'Forbidden - requires ADMIN role' })
  async getAuditLogs(@Query() query: AdminQueryAuditLogsDto) {
    return this.adminService.getAuditLogs(query);
  }

  @Get('audit-logs/:id')
  @ApiOperation({
    summary: 'Inspect Single Audit Log Entry',
    description: 'Retrieves full details of a single immutable audit log record.',
  })
  @ApiParam({ name: 'id', description: 'Audit log UUID' })
  @ApiResponse({ status: 200, description: 'Audit log entry retrieved' })
  @ApiResponse({ status: 404, description: 'Audit log not found' })
  async getAuditLogById(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.adminService.getAuditLogById(id);
  }
}

