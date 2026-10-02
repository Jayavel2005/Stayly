import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AdminUpdateHotelStatusDto {
  @ApiProperty({ description: 'Target active status for the hotel' })
  @IsBoolean()
  isActive: boolean;

  @ApiPropertyOptional({
    description: 'Operational reason for activating/deactivating hotel',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
