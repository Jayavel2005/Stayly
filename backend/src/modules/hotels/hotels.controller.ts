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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { HotelsService } from './hotels.service';
import { CreateHotelDto } from './dto/create-hotel.dto';
import { UpdateHotelDto } from './dto/update-hotel.dto';
import { QueryHotelsDto } from './dto/query-hotels.dto';
import { AssignManagerDto } from './dto/assign-manager.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../auth/types/user-role.enum';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';

@ApiTags('Hotels & Property Management')
@Controller()
export class HotelsController {
  constructor(private readonly hotelsService: HotelsService) {}

  // ===========================================================================
  // 1. Public Discovery Endpoints (Customer & Public Browsing)
  // ===========================================================================

  @Get('hotels')
  @ApiOperation({
    summary: 'Public Hotel Discovery',
    description:
      'Browse active hotels with database-level pagination, case-insensitive text search, and city/star-rating filters.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of active hotel properties.',
  })
  async findPublicHotels(@Query() query: QueryHotelsDto) {
    return this.hotelsService.findPublicHotels(query);
  }

  @Get('hotels/:id')
  @ApiOperation({
    summary: 'Public Hotel Details',
    description:
      'Retrieve full details of an active hotel property. Returns 404 if hotel is inactive or does not exist.',
  })
  @ApiParam({ name: 'id', description: 'UUID of the hotel property' })
  @ApiResponse({
    status: 200,
    description: 'Active hotel details retrieved.',
  })
  @ApiResponse({
    status: 404,
    description: 'Hotel property not found or inactive.',
  })
  async findPublicHotelById(@Param('id') id: string) {
    return this.hotelsService.findPublicHotelById(id);
  }

  @Get('customer/hotels')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Customer Portal Active Hotels',
    description: 'Customer authenticated list of active hotel properties.',
  })
  @ApiResponse({ status: 200, description: 'Active hotels list.' })
  @ApiResponse({ status: 403, description: 'Forbidden: Requires CUSTOMER role.' })
  async getHotelsForCustomer() {
    return this.hotelsService.getHotelsForCustomer();
  }

  // ===========================================================================
  // 2. Manager Portal Endpoints (Role: HOTEL_MANAGER + HotelManager Assignment)
  // ===========================================================================

  @Get('manager/hotels')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HOTEL_MANAGER)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'List Managed Hotels (Manager Portal)',
    description:
      'Returns only hotel properties explicitly assigned to the authenticated hotel manager via hotel_managers.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of assigned hotels retrieved.',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized: Missing or invalid JWT.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden: Requires HOTEL_MANAGER role.',
  })
  async getManagedHotels(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryHotelsDto,
  ) {
    return this.hotelsService.getManagedHotels(user.id, query);
  }

  @Get('manager/hotels/:hotelId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HOTEL_MANAGER)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get Managed Hotel by ID (Manager Portal)',
    description:
      'Fetches details of a specific hotel. Enforces resource authorization: Manager must be assigned to this hotel.',
  })
  @ApiParam({ name: 'hotelId', description: 'UUID of the hotel property' })
  @ApiResponse({
    status: 200,
    description: 'Hotel details retrieved.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden: Manager is not assigned to this hotel property.',
  })
  @ApiResponse({
    status: 404,
    description: 'Hotel not found.',
  })
  async getManagedHotel(
    @Param('hotelId') hotelId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.hotelsService.getHotelForManager(user.id, hotelId);
  }

  @Patch('manager/hotels/:hotelId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HOTEL_MANAGER)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Update Managed Hotel (Manager Portal)',
    description:
      'Updates hotel details. Enforces resource authorization: Manager must be assigned to this hotel.',
  })
  @ApiParam({ name: 'hotelId', description: 'UUID of the hotel property' })
  @ApiResponse({
    status: 200,
    description: 'Hotel updated successfully.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden: Manager is not assigned to this hotel property.',
  })
  async updateManagedHotel(
    @Param('hotelId') hotelId: string,
    @Body() dto: UpdateHotelDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.hotelsService.updateHotelForManager(user.id, hotelId, dto);
  }

  @Delete('manager/hotels/:hotelId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HOTEL_MANAGER)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Deactivate Managed Hotel (Manager Portal)',
    description:
      'Soft-deletes a hotel property. Enforces resource authorization: Manager must be assigned to this hotel.',
  })
  @ApiParam({ name: 'hotelId', description: 'UUID of the hotel property' })
  @ApiResponse({
    status: 200,
    description: 'Hotel deactivated successfully.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden: Manager is not assigned to this hotel property.',
  })
  async deleteManagedHotel(
    @Param('hotelId') hotelId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.hotelsService.deleteHotelForManager(user.id, hotelId);
  }

  // ===========================================================================
  // 3. Admin Portal Endpoints (Role: ADMIN)
  // ===========================================================================

  @Post('admin/hotels')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Create Hotel Property (Admin Portal)',
    description:
      'Creates a new hotel property. Strictly restricted to system administrators.',
  })
  @ApiResponse({
    status: 201,
    description: 'Hotel property created successfully.',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed or invalid initial manager ID.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden: Only administrators can create hotels.',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict: Hotel with this slug already exists.',
  })
  async createHotel(@Body() dto: CreateHotelDto) {
    return this.hotelsService.createHotel(dto);
  }

  @Get('admin/hotels')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'List All System Hotels (Admin Portal)',
    description:
      'System-wide property catalog for platform administrators including manager assignments and room counts.',
  })
  @ApiResponse({
    status: 200,
    description: 'Full hotel catalog retrieved.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden: User is not an ADMIN.',
  })
  async getAllHotelsForAdmin(@Query() query: QueryHotelsDto) {
    return this.hotelsService.getAllHotelsForAdmin(query);
  }

  @Get('admin/hotels/:hotelId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get Hotel for Administration',
    description: 'Retrieve full hotel record including room inventory and managers.',
  })
  @ApiParam({ name: 'hotelId', description: 'UUID of the hotel property' })
  @ApiResponse({ status: 200, description: 'Hotel details retrieved.' })
  @ApiResponse({ status: 403, description: 'Forbidden: Requires ADMIN role.' })
  @ApiResponse({ status: 404, description: 'Hotel not found.' })
  async getHotelForAdmin(@Param('hotelId') hotelId: string) {
    return this.hotelsService.getHotelForAdmin(hotelId);
  }

  @Post('admin/hotels/:hotelId/managers')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Assign Manager to Hotel (Admin Portal)',
    description: 'Establishes a manager-hotel assignment record in hotel_managers.',
  })
  @ApiParam({ name: 'hotelId', description: 'UUID of the hotel property' })
  @ApiResponse({ status: 200, description: 'Manager assigned successfully.' })
  @ApiResponse({ status: 400, description: 'User is not a valid active manager.' })
  @ApiResponse({ status: 404, description: 'Hotel property not found.' })
  async assignManager(
    @Param('hotelId') hotelId: string,
    @Body() dto: AssignManagerDto,
  ) {
    return this.hotelsService.assignManagerToHotel(hotelId, dto);
  }

  @Delete('admin/hotels/:hotelId/managers/:managerId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Unassign Manager from Hotel (Admin Portal)',
    description: 'Revokes a manager assignment from hotel_managers.',
  })
  @ApiParam({ name: 'hotelId', description: 'UUID of the hotel property' })
  @ApiParam({ name: 'managerId', description: 'UUID of the manager user' })
  @ApiResponse({ status: 200, description: 'Manager assignment revoked.' })
  @ApiResponse({ status: 404, description: 'Assignment not found.' })
  async unassignManager(
    @Param('hotelId') hotelId: string,
    @Param('managerId') managerId: string,
  ) {
    return this.hotelsService.unassignManagerFromHotel(hotelId, managerId);
  }
}
