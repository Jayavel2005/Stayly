import {
  IsNotEmpty,
  IsString,
  Matches,
  IsOptional,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class AvailabilityQueryDto {
  @ApiProperty({
    description: 'Check-in date in YYYY-MM-DD calendar format (inclusive check-in)',
    example: '2026-10-20',
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'checkIn must be a valid calendar date formatted as YYYY-MM-DD.',
  })
  checkIn: string;

  @ApiProperty({
    description: 'Check-out date in YYYY-MM-DD calendar format (exclusive check-out)',
    example: '2026-10-22',
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'checkOut must be a valid calendar date formatted as YYYY-MM-DD.',
  })
  checkOut: string;

  @ApiPropertyOptional({
    description: 'Total number of guests required per room',
    default: 1,
    minimum: 1,
    maximum: 20,
    example: 2,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  guests?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of rooms requested for this category',
    default: 1,
    minimum: 1,
    maximum: 10,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  rooms?: number = 1;
}
