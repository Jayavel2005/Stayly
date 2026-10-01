import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AvailabilityService } from './availability.service';
import { SearchHotelsDto } from './dto/search-hotels.dto';

@ApiTags('Hotel Search & Discovery')
@Controller('search')
export class SearchController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @Get('hotels')
  @ApiOperation({
    summary: 'Search Available Hotels by Date Range & Destination',
    description:
      'Customer-facing search engine for active hotel properties with real-time room availability. ' +
      'Evaluates operational room statuses and excludes overlapping active reservations using [checkIn, checkOut) semantics. ' +
      'Search results represent current snapshot availability and do not constitute an inventory hold or reservation.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of available hotels with eligible room categories.',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid date range, checkOut before checkIn, or past date query.',
  })
  async searchHotels(@Query() query: SearchHotelsDto) {
    return this.availabilityService.searchAvailableHotels(query);
  }
}
