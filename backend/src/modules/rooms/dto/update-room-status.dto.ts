import { IsNotEmpty, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { RoomOperationalStatus } from '../types/room-operational-status.enum';

export class UpdateRoomStatusDto {
  @ApiProperty({
    description: 'Updated operational status of the physical room unit',
    enum: RoomOperationalStatus,
    example: RoomOperationalStatus.MAINTENANCE,
  })
  @IsNotEmpty()
  @IsEnum(RoomOperationalStatus)
  status: RoomOperationalStatus;
}
