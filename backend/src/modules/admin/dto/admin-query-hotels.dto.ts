import {
  IsOptional,
  IsInt,
  Min,
  Max,
  IsString,
  IsBoolean,
  IsIn,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';

export class AdminQueryHotelsDto {
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

  @ApiPropertyOptional({ description: 'Filter by active status' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Search hotel name or description' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by city' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ description: 'Filter by state' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({
    enum: ['createdAt', 'name', 'city', 'starRating', 'isActive'],
    default: 'createdAt',
  })
  @IsOptional()
  @IsIn(['createdAt', 'name', 'city', 'starRating', 'isActive'])
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
