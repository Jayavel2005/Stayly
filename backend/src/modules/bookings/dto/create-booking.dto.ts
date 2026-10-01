import {
  IsUUID,
  IsNotEmpty,
  IsString,
  Matches,
  IsInt,
  Min,
  IsOptional,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateBookingDto {
  @ApiProperty({
    description: 'Target hotel property UUID',
    example: '44444444-4444-4444-8444-444444444444',
  })
  @IsUUID('4')
  @IsNotEmpty()
  hotelId: string;

  @ApiProperty({
    description: 'Target room category UUID to book',
    example: '57391b9b-ed2d-4e3d-bb09-63728b53254f',
  })
  @IsUUID('4')
  @IsNotEmpty()
  roomTypeId: string;

  @ApiProperty({
    description: 'Calendar check-in date in YYYY-MM-DD format (inclusive)',
    example: '2026-10-20',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'checkIn must be a valid calendar date formatted as YYYY-MM-DD.',
  })
  checkIn: string;

  @ApiProperty({
    description: 'Calendar check-out date in YYYY-MM-DD format (exclusive)',
    example: '2026-10-23',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'checkOut must be a valid calendar date formatted as YYYY-MM-DD.',
  })
  checkOut: string;

  @ApiProperty({
    description: 'Total number of guests occupying the room',
    example: 2,
    minimum: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  guests: number;

  @ApiPropertyOptional({
    description: 'Number of physical rooms to allocate for this category',
    example: 1,
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  rooms?: number = 1;
}
