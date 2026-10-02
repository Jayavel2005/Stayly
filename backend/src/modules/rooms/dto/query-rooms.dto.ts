import {
  IsOptional,
  IsInt,
  Min,
  Max,
  IsString,
  IsEnum,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { RoomOperationalStatus } from '../types/room-operational-status.enum';
import { RoomSortBy, RoomSortOrder } from '../types/room-sort-by.enum';

export class QueryRoomsDto {
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
    description: 'Filter rooms by parent hotel UUID',
    example: '44444444-4444-4444-8444-444444444444',
  })
  @IsOptional()
  @IsUUID('4')
  hotelId?: string;

  @ApiPropertyOptional({
    description: 'Filter rooms by RoomType category UUID',
    example: '33333333-3333-4333-8333-333333333333',
  })
  @IsOptional()
  @IsUUID('4')
  roomTypeId?: string;

  @ApiPropertyOptional({
    description: 'Filter by room operational status',
    enum: RoomOperationalStatus,
  })
  @IsOptional()
  @IsEnum(RoomOperationalStatus)
  operationalStatus?: RoomOperationalStatus;

  @ApiPropertyOptional({
    description: 'Filter by floor level',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  floor?: number;

  @ApiPropertyOptional({
    description: 'Search by room number substring',
    example: '101',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Field to sort by',
    enum: RoomSortBy,
    default: RoomSortBy.ROOM_NUMBER,
  })
  @IsOptional()
  @IsEnum(RoomSortBy)
  sortBy?: RoomSortBy = RoomSortBy.ROOM_NUMBER;

  @ApiPropertyOptional({
    description: 'Sort direction',
    enum: RoomSortOrder,
    default: RoomSortOrder.ASC,
  })
  @IsOptional()
  @IsEnum(RoomSortOrder)
  sortOrder?: RoomSortOrder = RoomSortOrder.ASC;
}
