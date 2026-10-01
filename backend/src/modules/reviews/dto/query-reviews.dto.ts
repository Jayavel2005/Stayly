import {
  IsOptional,
  IsInt,
  Min,
  Max,
  IsIn,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class QueryReviewsDto {
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
    description: 'Number of reviews per page',
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
    description: 'Sorting criteria from allowlist',
    enum: ['newest', 'oldest', 'highest', 'lowest', 'highest_rating', 'lowest_rating'],
    default: 'newest',
  })
  @IsOptional()
  @IsIn(['newest', 'oldest', 'highest', 'lowest', 'highest_rating', 'lowest_rating'], {
    message: 'sortBy must be one of: newest, oldest, highest, lowest, highest_rating, lowest_rating.',
  })
  sortBy?: string = 'newest';

  @ApiPropertyOptional({
    description: 'Filter reviews by specific star rating (1–5)',
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;
}
