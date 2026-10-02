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
import { RoomTypesService } from './room-types.service';
import { CreateRoomTypeDto } from './dto/create-room-type.dto';
import { UpdateRoomTypeDto } from './dto/update-room-type.dto';
import { QueryRoomTypesDto } from './dto/query-room-types.dto';
import {
  JwtAuthGuard,
  RolesGuard,
  OptionalJwtAuthGuard,
  Roles,
  CurrentUser,
} from '../../common';
import { UserRole } from '../auth/types/user-role.enum';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';

@ApiTags('Room Categories & Types')
@Controller('room-types')
export class RoomTypesController {
  constructor(private readonly roomTypesService: RoomTypesService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.HOTEL_MANAGER)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Create Room Category / Type',
    description:
      'Creates a new room category (e.g. Deluxe Suite, Ocean King) within an authorized hotel property. ' +
      'Admin users can create for any active hotel; Managers can only create for hotels assigned to them.',
  })
  @ApiResponse({ status: 201, description: 'Room category created successfully.' })
  @ApiResponse({ status: 400, description: 'Validation failed or invalid occupancy.' })
  @ApiResponse({ status: 401, description: 'Unauthorized: Missing or invalid token.' })
  @ApiResponse({ status: 403, description: 'Forbidden: Insufficient role or not assigned to hotel.' })
  @ApiResponse({ status: 404, description: 'Hotel property not found.' })
  @ApiResponse({ status: 409, description: 'Room type with this name or slug already exists in this hotel.' })
  async createRoomType(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRoomTypeDto,
  ) {
    return this.roomTypesService.createRoomType(user, dto);
  }

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary: 'List & Filter Room Categories',
    description:
      'Retrieve paginated room types with optional filtering by hotelId, search term, and sorting. ' +
      'Public customers receive only active categories for active hotels; Managers receive assigned property room types; Admins receive global oversight.',
  })
  @ApiResponse({ status: 200, description: 'Paginated list of room categories.' })
  async findRoomTypes(
    @Query() query: QueryRoomTypesDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.roomTypesService.findRoomTypes(query, user || undefined);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary: 'Get Room Category by ID',
    description:
      'Retrieve a single room type profile with amenities and property details. ' +
      'Public discovery returns 404 if the category or parent hotel is inactive/deleted.',
  })
  @ApiParam({ name: 'id', description: 'UUID of the room type' })
  @ApiResponse({ status: 200, description: 'Room category retrieved.' })
  @ApiResponse({ status: 403, description: 'Forbidden: Manager not assigned to parent property.' })
  @ApiResponse({ status: 404, description: 'Room category not found.' })
  async findRoomTypeById(
    @Param('id') id: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.roomTypesService.findRoomTypeById(id, user || undefined);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.HOTEL_MANAGER)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Update Room Category',
    description:
      'Partially update room category attributes (pricing, capacity, description, bedding). ' +
      'Room categories cannot be transferred between hotels.',
  })
  @ApiParam({ name: 'id', description: 'UUID of the room type' })
  @ApiResponse({ status: 200, description: 'Room category updated successfully.' })
  @ApiResponse({ status: 400, description: 'Validation error.' })
  @ApiResponse({ status: 403, description: 'Forbidden: Manager not assigned to parent hotel.' })
  @ApiResponse({ status: 404, description: 'Room category not found.' })
  @ApiResponse({ status: 409, description: 'Conflict: Duplicate slug or name collision.' })
  async updateRoomType(
    @Param('id') id: string,
    @Body() dto: UpdateRoomTypeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.roomTypesService.updateRoomType(id, dto, user);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.HOTEL_MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Delete or Soft-Deactivate Room Category',
    description:
      'Soft-deletes a room category. If the category currently contains active physical inventory rooms, ' +
      'deletion is blocked with 409 Conflict to preserve referential and inventory integrity.',
  })
  @ApiParam({ name: 'id', description: 'UUID of the room type' })
  @ApiResponse({ status: 200, description: 'Room category soft-deleted.' })
  @ApiResponse({ status: 403, description: 'Forbidden: Manager not assigned to hotel.' })
  @ApiResponse({ status: 404, description: 'Room category not found.' })
  @ApiResponse({ status: 409, description: 'Conflict: Room category still contains active physical rooms.' })
  async deleteRoomType(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.roomTypesService.deleteRoomType(id, user);
  }
}
