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
} from '@nestjs/swagger';
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { UpdateRoomStatusDto } from './dto/update-room-status.dto';
import { QueryRoomsDto } from './dto/query-rooms.dto';
import {
  JwtAuthGuard,
  RolesGuard,
  Roles,
  CurrentUser,
} from '../../common';
import { UserRole } from '../auth/types/user-role.enum';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';

@ApiTags('Room Physical Inventory')
@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.HOTEL_MANAGER)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Create Physical Inventory Room',
    description:
      'Creates a new physical room unit (e.g. Room 101, 102A) mapped to a valid RoomType category. ' +
      'The parent hotel is derived directly from the room category. ' +
      'Room numbers must be unique within the hotel property.',
  })
  @ApiResponse({ status: 201, description: 'Room created successfully.' })
  @ApiResponse({ status: 400, description: 'Validation error or cross-hotel mismatch.' })
  @ApiResponse({ status: 401, description: 'Unauthorized: Missing or invalid token.' })
  @ApiResponse({ status: 403, description: 'Forbidden: Caller not assigned to manage property.' })
  @ApiResponse({ status: 404, description: 'Room category not found.' })
  @ApiResponse({ status: 409, description: 'Room number already exists in this hotel.' })
  async createRoom(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRoomDto,
  ) {
    return this.roomsService.createRoom(user, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.HOTEL_MANAGER)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'List & Filter Physical Rooms',
    description:
      'Retrieve paginated physical room inventory units for operational management. ' +
      'Customer accounts cannot access physical room numbers directly. ' +
      'Managers can only list rooms for hotels assigned to them.',
  })
  @ApiResponse({ status: 200, description: 'Paginated list of rooms.' })
  @ApiResponse({ status: 403, description: 'Forbidden: Insufficient privileges.' })
  async findRooms(
    @Query() query: QueryRoomsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.roomsService.findRooms(query, user);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.HOTEL_MANAGER)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get Physical Room by ID',
    description:
      'Retrieve physical room unit details, current operational status, and room category metadata.',
  })
  @ApiParam({ name: 'id', description: 'UUID of the physical room' })
  @ApiResponse({ status: 200, description: 'Room retrieved successfully.' })
  @ApiResponse({ status: 403, description: 'Forbidden: Caller not assigned to property.' })
  @ApiResponse({ status: 404, description: 'Room not found.' })
  async findRoomById(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.roomsService.findRoomById(id, user);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.HOTEL_MANAGER)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Update Physical Room',
    description:
      'Update room number, floor, or category. Reassigning category is strictly restricted to categories in the SAME hotel.',
  })
  @ApiParam({ name: 'id', description: 'UUID of the physical room' })
  @ApiResponse({ status: 200, description: 'Room updated successfully.' })
  @ApiResponse({ status: 400, description: 'Validation error or cross-hotel reassignment.' })
  @ApiResponse({ status: 403, description: 'Forbidden: Caller not assigned to property.' })
  @ApiResponse({ status: 404, description: 'Room not found.' })
  @ApiResponse({ status: 409, description: 'Room number collision in this hotel.' })
  async updateRoom(
    @Param('id') id: string,
    @Body() dto: UpdateRoomDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.roomsService.updateRoom(id, dto, user);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.HOTEL_MANAGER)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Update Room Operational Status',
    description:
      'Transition the physical room operational status between AVAILABLE, MAINTENANCE, and OUT_OF_SERVICE. ' +
      'Operational status indicates physical readiness and is distinct from date-specific booking availability.',
  })
  @ApiParam({ name: 'id', description: 'UUID of the physical room' })
  @ApiResponse({ status: 200, description: 'Room operational status updated.' })
  @ApiResponse({ status: 400, description: 'Invalid operational status enum.' })
  @ApiResponse({ status: 403, description: 'Forbidden: Caller not assigned to property.' })
  @ApiResponse({ status: 404, description: 'Room not found.' })
  async updateRoomStatus(
    @Param('id') id: string,
    @Body() dto: UpdateRoomStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.roomsService.updateRoomStatus(id, dto.status, user);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.HOTEL_MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Soft-Delete Physical Room',
    description:
      'Marks a physical room as OUT_OF_SERVICE and sets soft-delete timestamp. Does not cascade-delete downstream audit or historical data.',
  })
  @ApiParam({ name: 'id', description: 'UUID of the physical room' })
  @ApiResponse({ status: 200, description: 'Room soft-deleted successfully.' })
  @ApiResponse({ status: 403, description: 'Forbidden: Caller not assigned to property.' })
  @ApiResponse({ status: 404, description: 'Room not found.' })
  async deleteRoom(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.roomsService.deleteRoom(id, user);
  }
}
