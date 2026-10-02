import { IsOptional, IsISO8601 } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class AdminDashboardQueryDto {
  @ApiPropertyOptional({
    description: 'Start date filter for temporal metrics (ISO 8601)',
    example: '2026-09-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({
    description: 'End date filter for temporal metrics (ISO 8601)',
    example: '2026-10-01T23:59:59.999Z',
  })
  @IsOptional()
  @IsISO8601()
  to?: string;
}
