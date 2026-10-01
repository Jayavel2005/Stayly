import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsInt,
  IsOptional,
  Min,
  Max,
  Length,
  MaxLength,
  MinLength,
  IsBoolean,
  IsNumber,
  IsArray,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateRoomTypeDto {
  @ApiProperty({
    description: 'UUID of the parent hotel property',
    example: '44444444-4444-4444-8444-444444444444',
  })
  @IsUUID('4')
  @IsNotEmpty()
  hotelId: string;

  @ApiProperty({
    description: 'Display name of the room category/type',
    example: 'Deluxe Sea View Suite',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({
    description: 'URL-friendly unique slug within the hotel property (auto-generated if omitted)',
    example: 'deluxe-sea-view-suite',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  slug?: string;

  @ApiProperty({
    description: 'Detailed description of the room type, furnishings, and view',
    example: 'Spacious suite featuring king bed, panoramic ocean views, marble bathroom and private balcony.',
    maxLength: 2000,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(2000)
  description: string;

  @ApiPropertyOptional({
    description: 'Maximum total guests accommodated',
    default: 2,
    minimum: 1,
    maximum: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  maxOccupancy?: number;

  @ApiPropertyOptional({
    description: 'Maximum adults accommodated',
    default: 2,
    minimum: 1,
    maximum: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  maxAdults?: number;

  @ApiPropertyOptional({
    description: 'Maximum children accommodated',
    default: 1,
    minimum: 0,
    maximum: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10)
  maxChildren?: number;

  @ApiProperty({
    description: 'Base price per night in smallest currency unit (cents or paise, e.g. 500000 = ₹5,000.00)',
    example: 500000,
    minimum: 0,
  })
  @IsNotEmpty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  basePriceCents: number;

  @ApiPropertyOptional({
    description: 'ISO-4217 three-letter currency code',
    default: 'INR',
    example: 'INR',
    minLength: 3,
    maxLength: 3,
  })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional({
    description: 'Primary bedding configuration (e.g. KING, QUEEN, TWIN, DOUBLE)',
    default: 'KING',
    example: 'KING',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  bedType?: string;

  @ApiPropertyOptional({
    description: 'Floor area in square meters',
    example: 45.5,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  sizeSqMeters?: number;

  @ApiPropertyOptional({
    description: 'Whether the room type is active and eligible for guest booking',
    default: true,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'List of Amenity UUIDs to associate with this room type',
    type: [String],
    example: ['11111111-1111-1111-8111-111111111111'],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  amenityIds?: string[];
}
