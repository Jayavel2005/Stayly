import {
  IsOptional,
  IsInt,
  Min,
  Max,
  IsString,
  IsEnum,
  IsUUID,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { RoomTypeSortBy, SortOrder } from '../types/room-type-sort-by.enum';

export class QueryRoomTypesDto {
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
    description: 'Filter room types by parent hotel UUID',
    example: '44444444-4444-4444-8444-444444444444',
  })
  @IsOptional()
  @IsUUID('4')
  hotelId?: string;

  @ApiPropertyOptional({
    description: 'Case-insensitive search by room type name or description',
    example: 'Deluxe',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by active operational status',
    default: true,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Field to sort by',
    enum: RoomTypeSortBy,
    default: RoomTypeSortBy.CREATED_AT,
  })
  @IsOptional()
  @IsEnum(RoomTypeSortBy)
  sortBy?: RoomTypeSortBy = RoomTypeSortBy.CREATED_AT;

  @ApiPropertyOptional({
    description: 'Sorting direction',
    enum: SortOrder,
    default: SortOrder.DESC,
  })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.DESC;
}
