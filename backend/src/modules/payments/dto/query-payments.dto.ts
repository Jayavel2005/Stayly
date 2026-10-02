import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class QueryPaymentsDto {
  @ApiPropertyOptional({
    description: 'Filter payments by specific booking UUID v4',
    example: '10594466-e472-4e5b-887f-1e624e255292',
  })
  @IsOptional()
  @IsUUID('4', { message: 'bookingId must be a valid UUID v4' })
  bookingId?: string;

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
    description: 'Page size limit for pagination',
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
}
