import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { AvailabilityService } from './availability.service';
import { AvailabilityQueryDto } from './dto/availability-query.dto';

@ApiTags('Date-Range Inventory Availability')
@Controller('availability')
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @Get('hotels/:hotelId')
  @ApiOperation({
    summary: 'Check Hotel Real-Time Availability by Date Range',
    description:
      'Evaluates all room categories for a specific hotel property across requested dates [checkIn, checkOut). ' +
      'Returns eligible room categories with physical room availability counts.',
  })
  @ApiParam({ name: 'hotelId', description: 'UUID of the hotel property' })
  @ApiResponse({ status: 200, description: 'Hotel availability profile retrieved.' })
  @ApiResponse({ status: 400, description: 'Invalid date range parameter.' })
  @ApiResponse({ status: 404, description: 'Hotel property not found or inactive.' })
  async getHotelAvailability(
    @Param('hotelId') hotelId: string,
    @Query() query: AvailabilityQueryDto,
  ) {
    return this.availabilityService.getHotelAvailability(hotelId, query);
  }

  @Get('room-types/:roomTypeId')
  @ApiOperation({
    summary: 'Check Room Category Availability by Date Range',
    description:
      'Returns detailed inventory availability summary for a specific room category, ' +
      'including total operational rooms, occupied rooms, and available room counts.',
  })
  @ApiParam({ name: 'roomTypeId', description: 'UUID of the room category' })
  @ApiResponse({ status: 200, description: 'Room category availability summary.' })
  @ApiResponse({ status: 400, description: 'Invalid date range parameter.' })
  @ApiResponse({ status: 404, description: 'Room category not found.' })
  async getRoomTypeAvailability(
    @Param('roomTypeId') roomTypeId: string,
    @Query() query: AvailabilityQueryDto,
  ) {
    const { checkInDate, checkOutDate } =
      this.availabilityService.validateDateRange(
        query.checkIn,
        query.checkOut,
      );

    return this.availabilityService.getRoomTypeAvailability(
      roomTypeId,
      checkInDate,
      checkOutDate,
    );
  }
}
