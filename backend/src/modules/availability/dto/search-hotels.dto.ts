import {
  IsOptional,
  IsString,
  IsUUID,
  IsInt,
  Min,
  Max,
  IsEnum,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import { AvailabilityQueryDto } from './availability-query.dto';
import { SearchSortBy, SearchSortOrder } from '../types/search-sort-by.enum';

export class SearchHotelsDto extends AvailabilityQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by city (case-insensitive substring match)',
    example: 'Mumbai',
  })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({
    description: 'Filter by state or province',
    example: 'Maharashtra',
  })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({
    description: 'Filter by country',
    example: 'India',
  })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({
    description: 'Search by hotel name or description substring',
    example: 'Grand',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by target hotel UUID',
    example: '44444444-4444-4444-8444-444444444444',
  })
  @IsOptional()
  @IsUUID('4')
  hotelId?: string;

  @ApiPropertyOptional({
    description: 'Filter by target room category UUID',
    example: '33333333-3333-4333-8333-333333333333',
  })
  @IsOptional()
  @IsUUID('4')
  roomTypeId?: string;

  @ApiPropertyOptional({
    description: 'Exact hotel star rating filter (1–5)',
    minimum: 1,
    maximum: 5,
    example: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  starRating?: number;

  @ApiPropertyOptional({
    description: 'Minimum hotel star rating threshold (1–5)',
    minimum: 1,
    maximum: 5,
    example: 4,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  minRating?: number;

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
    description: 'Field to sort hotels by',
    enum: SearchSortBy,
    default: SearchSortBy.CREATED_AT,
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toLowerCase() : value,
  )
  @IsEnum(SearchSortBy)
  sortBy?: SearchSortBy = SearchSortBy.CREATED_AT;

  @ApiPropertyOptional({
    description: 'Sort direction',
    enum: SearchSortOrder,
    default: SearchSortOrder.ASC,
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toLowerCase() : value,
  )
  @IsEnum(SearchSortOrder)
  sortOrder?: SearchSortOrder = SearchSortOrder.ASC;
}
