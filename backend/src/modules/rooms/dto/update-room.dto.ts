import {
  IsString,
  IsOptional,
  IsUUID,
  IsInt,
  MaxLength,
  MinLength,
  IsEnum,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { RoomOperationalStatus } from '../types/room-operational-status.enum';

export class UpdateRoomDto {
  @ApiPropertyOptional({
    description: 'Updated room identifier within the hotel',
    example: '101B',
    maxLength: 20,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  roomNumber?: string;

  @ApiPropertyOptional({
    description: 'Updated floor level',
    example: 2,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  floor?: number;

  @ApiPropertyOptional({
    description: 'Updated operational status',
    enum: RoomOperationalStatus,
  })
  @IsOptional()
  @IsEnum(RoomOperationalStatus)
  operationalStatus?: RoomOperationalStatus;

  @ApiPropertyOptional({
    description: 'Reassign room to another RoomType within the SAME hotel property',
    example: '33333333-3333-4333-8333-333333333333',
  })
  @IsOptional()
  @IsUUID('4')
  roomTypeId?: string;
}
