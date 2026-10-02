import {
  IsOptional,
  IsInt,
  Min,
  Max,
  IsUUID,
  IsEnum,
  IsString,
  IsISO8601,
  IsIn,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import { BookingStatus } from '../../bookings/types/booking-status.enum';

export class AdminQueryBookingsDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ enum: BookingStatus })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  @ApiPropertyOptional({ description: 'Filter by hotel UUID' })
  @IsOptional()
  @IsUUID('4')
  hotelId?: string;

  @ApiPropertyOptional({ description: 'Filter by customer UUID' })
  @IsOptional()
  @IsUUID('4')
  customerId?: string;

  @ApiPropertyOptional({ description: 'Filter by booking reference string' })
  @IsOptional()
  @IsString()
  bookingReference?: string;

  @ApiPropertyOptional({ description: 'Check-in date from (ISO 8601)' })
  @IsOptional()
  @IsISO8601()
  checkInFrom?: string;

  @ApiPropertyOptional({ description: 'Check-in date to (ISO 8601)' })
  @IsOptional()
  @IsISO8601()
  checkInTo?: string;

  @ApiPropertyOptional({ description: 'Created at from (ISO 8601)' })
  @IsOptional()
  @IsISO8601()
  createdAtFrom?: string;

  @ApiPropertyOptional({ description: 'Created at to (ISO 8601)' })
  @IsOptional()
  @IsISO8601()
  createdAtTo?: string;

  @ApiPropertyOptional({
    enum: ['createdAt', 'checkInDate', 'checkOutDate', 'totalAmountCents', 'status'],
    default: 'createdAt',
  })
  @IsOptional()
  @IsIn(['createdAt', 'checkInDate', 'checkOutDate', 'totalAmountCents', 'status'])
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
