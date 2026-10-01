import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Body,
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
} from '@nestjs/swagger';
import { HotelsService } from './hotels.service';
import { UpdateHotelDto } from './dto/update-hotel.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../auth/types/user-role.enum';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';

@ApiTags('Hotels & Authorization')
@ApiBearerAuth('JWT-auth')
@Controller()
export class HotelsController {
  constructor(private readonly hotelsService: HotelsService) {}

  // ---------------------------------------------------------------------------
  // Manager Web Portal Endpoints (Role: HOTEL_MANAGER + HotelManager Assignment)
  // ---------------------------------------------------------------------------

  @Get('manager/hotels')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HOTEL_MANAGER)
  @ApiOperation({
    summary: 'List Managed Hotels (Manager Portal)',
    description:
      'Returns only the hotel properties explicitly assigned to the authenticated hotel manager via hotel_managers.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of assigned hotels retrieved.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden: User does not possess the HOTEL_MANAGER role.',
  })
  async getManagedHotels(@CurrentUser() user: AuthenticatedUser) {
    return this.hotelsService.getManagedHotels(user.id);
  }

  @Get('manager/hotels/:hotelId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HOTEL_MANAGER)
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

  // ---------------------------------------------------------------------------
  // Admin Portal Endpoints (Role: ADMIN)
  // ---------------------------------------------------------------------------

  @Get('admin/hotels')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'List All System Hotels (Admin Portal)',
    description:
      'System-wide property catalog for platform administrators. Inaccessible to customers and managers.',
  })
  @ApiResponse({
    status: 200,
    description: 'Full hotel catalog retrieved.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden: User is not an ADMIN.',
  })
  async getAllHotelsForAdmin() {
    return this.hotelsService.getAllHotelsForAdmin();
  }

  // ---------------------------------------------------------------------------
  // Customer Portal Endpoints (Role: CUSTOMER)
  // ---------------------------------------------------------------------------

  @Get('customer/hotels')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER)
  @ApiOperation({
    summary: 'Browse Available Hotels (Customer Portal)',
    description:
      'Browse active hotels for customers. Inaccessible to managers or admins without customer role.',
  })
  @ApiResponse({
    status: 200,
    description: 'Active hotels list.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden: User is not a CUSTOMER.',
  })
  async getHotelsForCustomer() {
    return this.hotelsService.getHotelsForCustomer();
  }
}
