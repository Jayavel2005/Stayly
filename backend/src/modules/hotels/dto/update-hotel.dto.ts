import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class UpdateHotelDto {
  @ApiPropertyOptional({ example: 'Stayora Royal Palace Mumbai' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 'Updated description of royal heritage suites.' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: '+912266653399' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ example: 'concierge@stayora.com' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  starRating?: number;
}
