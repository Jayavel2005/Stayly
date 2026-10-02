import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export enum HotelSortBy {
  NAME = 'name',
  STAR_RATING = 'starRating',
  CREATED_AT = 'createdAt',
  CITY = 'city',
}

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export class QueryHotelsDto {
  @ApiPropertyOptional({
    example: 1,
    description: 'Page number for pagination',
    default: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({
    example: 20,
    description: 'Maximum items per page (maximum: 100)',
    default: 20,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({
    example: 'Mumbai',
    description: 'Filter by city (case-insensitive substring/exact)',
  })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiPropertyOptional({
    example: 'Maharashtra',
    description: 'Filter by state / province',
  })
  @IsString()
  @IsOptional()
  state?: string;

  @ApiPropertyOptional({
    example: 'India',
    description: 'Filter by country',
  })
  @IsString()
  @IsOptional()
  country?: string;

  @ApiPropertyOptional({
    example: 'Grand',
    description: 'Search term matched against hotel name',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    example: 5,
    description: 'Exact star rating (1-5)',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  starRating?: number;

  @ApiPropertyOptional({
    example: 4,
    description: 'Minimum star rating threshold (1-5)',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  minRating?: number;

  @ApiPropertyOptional({
    enum: HotelSortBy,
    example: HotelSortBy.CREATED_AT,
    description: 'Field to sort records by',
    default: HotelSortBy.CREATED_AT,
  })
  @IsEnum(HotelSortBy)
  @IsOptional()
  sortBy?: HotelSortBy = HotelSortBy.CREATED_AT;

  @ApiPropertyOptional({
    enum: SortOrder,
    example: SortOrder.DESC,
    description: 'Sorting direction',
    default: SortOrder.DESC,
  })
  @IsEnum(SortOrder)
  @IsOptional()
  sortOrder?: SortOrder = SortOrder.DESC;
}
