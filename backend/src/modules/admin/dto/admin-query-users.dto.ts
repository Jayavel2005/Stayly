import {
  IsOptional,
  IsInt,
  Min,
  Max,
  IsEnum,
  IsString,
  IsIn,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { UserRole, UserStatus } from '../../auth/types/user-role.enum';

export class AdminQueryUsersDto {
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

  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({ description: 'Search term for name or email' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: ['createdAt', 'email', 'firstName', 'lastName', 'role', 'status'],
    default: 'createdAt',
  })
  @IsOptional()
  @IsIn(['createdAt', 'email', 'firstName', 'lastName', 'role', 'status'])
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
