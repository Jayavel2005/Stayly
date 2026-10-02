import {
  IsOptional,
  IsInt,
  Min,
  Max,
  IsUUID,
  IsString,
  IsISO8601,
  IsIn,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class AdminQueryPaymentsDto {
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

  @ApiPropertyOptional({ description: 'Filter by payment status (PENDING, COMPLETED, FAILED)' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Filter by booking UUID' })
  @IsOptional()
  @IsUUID('4')
  bookingId?: string;

  @ApiPropertyOptional({ description: 'Filter by gateway provider' })
  @IsOptional()
  @IsString()
  gatewayProvider?: string;

  @ApiPropertyOptional({ description: 'Created at from (ISO 8601)' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ description: 'Created at to (ISO 8601)' })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional({
    enum: ['createdAt', 'amountCents', 'status', 'settledAt'],
    default: 'createdAt',
  })
  @IsOptional()
  @IsIn(['createdAt', 'amountCents', 'status', 'settledAt'])
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
