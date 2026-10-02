import { IsOptional, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class AdminAssignManagerDto {
  @ApiPropertyOptional({
    description: 'Whether this manager is the primary contact for the hotel',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean = false;
}
