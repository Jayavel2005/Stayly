import {
  IsOptional,
  IsInt,
  Min,
  Max,
  IsUUID,
  IsEnum,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import { BookingStatus } from '../types/booking-status.enum';

export class QueryBookingsDto {
  @ApiPropertyOptional({
    description: 'Page number for pagination',
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Filter bookings by lifecycle status',
    enum: BookingStatus,
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  @ApiPropertyOptional({
    description: 'Filter bookings by hotel property UUID',
  })
  @IsOptional()
  @IsUUID('4')
  hotelId?: string;

  @ApiPropertyOptional({
    description: 'Filter bookings by customer UUID (ADMIN only)',
  })
  @IsOptional()
  @IsUUID('4')
  customerId?: string;
}
