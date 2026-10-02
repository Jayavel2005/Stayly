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
import { UserStatus } from '../../auth/types/user-role.enum';

export class AdminQueryManagersDto {
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

  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({ description: 'Search term for name or email' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: ['createdAt', 'email', 'firstName', 'lastName', 'status'],
    default: 'createdAt',
  })
  @IsOptional()
  @IsIn(['createdAt', 'email', 'firstName', 'lastName', 'status'])
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
