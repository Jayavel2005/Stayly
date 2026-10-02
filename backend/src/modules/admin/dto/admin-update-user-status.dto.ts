import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserStatus } from '../../auth/types/user-role.enum';

export class AdminUpdateUserStatusDto {
  @ApiProperty({ enum: UserStatus, description: 'Target user status' })
  @IsEnum(UserStatus)
  status: UserStatus;

  @ApiPropertyOptional({
    description: 'Operational justification or reason for status update',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
