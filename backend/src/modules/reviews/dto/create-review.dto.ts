import {
  IsUUID,
  IsNotEmpty,
  IsInt,
  Min,
  Max,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateReviewDto {
  @ApiProperty({
    description: 'UUID of the completed reservation being reviewed',
    example: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
  })
  @IsUUID('4')
  @IsNotEmpty()
  bookingId: string;

  @ApiProperty({
    description: 'Rating score from 1 (lowest) to 5 (highest)',
    example: 5,
    minimum: 1,
    maximum: 5,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'rating must be an integer between 1 and 5.' })
  @Max(5, { message: 'rating must be an integer between 1 and 5.' })
  rating: number;

  @ApiPropertyOptional({
    description: 'Optional headline/title for the review',
    example: 'Wonderful stay overlooking the sea',
    maxLength: 150,
  })
  @IsOptional()
  @IsString()
  @MaxLength(150, { message: 'title must not exceed 150 characters.' })
  title?: string;

  @ApiProperty({
    description: 'Detailed review comment describing guest experience',
    example: 'The staff was attentive, room was spotless, and the breakfast spread was superb.',
    minLength: 5,
    maxLength: 2000,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(5, { message: 'comment must be at least 5 characters long.' })
  @MaxLength(2000, { message: 'comment must not exceed 2000 characters.' })
  comment: string;
}
