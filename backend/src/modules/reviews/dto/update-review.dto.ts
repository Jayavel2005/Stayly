import {
  IsInt,
  Min,
  Max,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class UpdateReviewDto {
  @ApiPropertyOptional({
    description: 'Updated rating score from 1 to 5',
    example: 4,
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'rating must be an integer between 1 and 5.' })
  @Max(5, { message: 'rating must be an integer between 1 and 5.' })
  rating?: number;

  @ApiPropertyOptional({
    description: 'Updated headline/title for the review',
    example: 'Pleasant experience overall',
    maxLength: 150,
  })
  @IsOptional()
  @IsString()
  @MaxLength(150, { message: 'title must not exceed 150 characters.' })
  title?: string;

  @ApiPropertyOptional({
    description: 'Updated review feedback comment',
    example: 'Comfortable stay with great amenities, but breakfast service was slightly slow on day 2.',
    minLength: 5,
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @MinLength(5, { message: 'comment must be at least 5 characters long.' })
  @MaxLength(2000, { message: 'comment must not exceed 2000 characters.' })
  comment?: string;
}
