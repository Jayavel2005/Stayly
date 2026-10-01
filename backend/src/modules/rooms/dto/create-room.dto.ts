import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsInt,
  IsOptional,
  MaxLength,
  MinLength,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { RoomOperationalStatus } from '../types/room-operational-status.enum';

export class CreateRoomDto {
  @ApiProperty({
    description: 'UUID of the RoomType category this physical inventory unit belongs to',
    example: '33333333-3333-4333-8333-333333333333',
  })
  @IsUUID('4')
  @IsNotEmpty()
  roomTypeId: string;

  @ApiProperty({
    description: 'Physical room identifier/number within the hotel (e.g. 101, 102A, PH-1)',
    example: '101',
    maxLength: 20,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(20)
  roomNumber: string;

  @ApiPropertyOptional({
    description: 'Floor level of the room unit',
    default: 1,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  floor?: number = 1;

  @ApiPropertyOptional({
    description: 'Initial operational status of the physical room',
    enum: RoomOperationalStatus,
    default: RoomOperationalStatus.AVAILABLE,
  })
  @IsOptional()
  @IsEnum(RoomOperationalStatus)
  operationalStatus?: RoomOperationalStatus = RoomOperationalStatus.AVAILABLE;

  @ApiPropertyOptional({
    description: 'Optional parent hotel UUID (validated against roomTypeId parent hotel)',
    example: '44444444-4444-4444-8444-444444444444',
  })
  @IsOptional()
  @IsUUID('4')
  hotelId?: string;
}
