import { IsOptional, IsInt, Min, Max, IsBoolean, IsIn, IsString } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class QueryNotificationsDto {
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
    description: 'Number of notifications per page',
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
    description: 'Filter by read/unread state',
    example: false,
  })
  @IsOptional()
  @Transform(({ obj, key }) => {
    const val = obj[key];
    if (val === 'true' || val === true || val === '1' || val === 1) return true;
    if (val === 'false' || val === false || val === '0' || val === 0) return false;
    return val;
  })
  @IsBoolean()
  isRead?: boolean;

  @ApiPropertyOptional({
    description: 'Sort ordering allowlist',
    enum: ['newest', 'oldest'],
    default: 'newest',
  })
  @IsOptional()
  @IsString()
  @IsIn(['newest', 'oldest'])
  sortBy?: 'newest' | 'oldest' = 'newest';
}
