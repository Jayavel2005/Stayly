import {
  IsOptional,
  IsInt,
  Min,
  Max,
  IsUUID,
  IsBoolean,
  IsIn,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';

export class AdminQueryReviewsDto {
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

  @ApiPropertyOptional({ description: 'Filter by hotel UUID' })
  @IsOptional()
  @IsUUID('4')
  hotelId?: string;

  @ApiPropertyOptional({ description: 'Filter by customer UUID' })
  @IsOptional()
  @IsUUID('4')
  customerId?: string;

  @ApiPropertyOptional({ description: 'Filter by exact star rating (1-5)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiPropertyOptional({ description: 'Filter by publication moderation status' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  isPublished?: boolean;

  @ApiPropertyOptional({
    enum: ['createdAt', 'rating', 'isPublished'],
    default: 'createdAt',
  })
  @IsOptional()
  @IsIn(['createdAt', 'rating', 'isPublished'])
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
