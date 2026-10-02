import {
  IsOptional,
  IsInt,
  Min,
  Max,
  IsUUID,
  IsString,
  IsBoolean,
  IsISO8601,
  IsIn,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';

export class AdminQueryNotificationsDto {
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

  @ApiPropertyOptional({ description: 'Filter by recipient user UUID' })
  @IsOptional()
  @IsUUID('4')
  userId?: string;

  @ApiPropertyOptional({ description: 'Filter by notification type' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ description: 'Filter by read state' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  isRead?: boolean;

  @ApiPropertyOptional({ description: 'Created at from (ISO 8601)' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ description: 'Created at to (ISO 8601)' })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional({
    enum: ['createdAt', 'type', 'isRead'],
    default: 'createdAt',
  })
  @IsOptional()
  @IsIn(['createdAt', 'type', 'isRead'])
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
