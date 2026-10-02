import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateRoomTypeDto } from './create-room-type.dto';

export class UpdateRoomTypeDto extends PartialType(
  OmitType(CreateRoomTypeDto, ['hotelId'] as const),
) {}
