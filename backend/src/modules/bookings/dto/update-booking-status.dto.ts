import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { BookingStatus } from '../types/booking-status.enum';

export class UpdateBookingStatusDto {
  @ApiProperty({
    description: 'Target lifecycle status for the booking',
    enum: BookingStatus,
    example: BookingStatus.CHECKED_IN,
  })
  @IsNotEmpty()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsEnum(BookingStatus)
  status: BookingStatus;
}
