import {
  IsOptional,
  IsInt,
  Min,
  Max,
  IsUUID,
  IsString,
  IsIn,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class AdminQueryAuditLogsDto {
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
    description: 'Maximum items per page',
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
    description: 'Filter audit logs by actor (user) UUID',
  })
  @IsOptional()
  @IsUUID('4')
  actorId?: string;

  @ApiPropertyOptional({
    description: 'Filter by entity type (e.g. USER, HOTEL, BOOKING, REVIEW)',
  })
  @IsOptional()
  @IsString()
  entityType?: string;

  @ApiPropertyOptional({
    description: 'Filter by target entity UUID',
  })
  @IsOptional()
  @IsUUID('4')
  entityId?: string;

  @ApiPropertyOptional({
    description: 'Filter by action name (e.g. USER_STATUS_UPDATED, HOTEL_STATUS_UPDATED, BOOKING_CHECKED_IN)',
  })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional({
    description: 'Search term matched against action or entityType',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Allowlisted field to sort records by',
    enum: ['createdAt'],
    default: 'createdAt',
  })
  @IsOptional()
  @IsIn(['createdAt'])
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({
    description: 'Sort direction',
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
