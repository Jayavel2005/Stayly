import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { PaymentMethod } from '../types/payment-status.enum';

export class CreatePaymentDto {
  @ApiProperty({
    description:
      'Authoritative UUID v4 of the reservation/booking to settle payment for.',
    example: '10594466-e472-4e5b-887f-1e624e255292',
  })
  @IsUUID('4', { message: 'bookingId must be a valid UUID v4' })
  @IsNotEmpty({ message: 'bookingId is required' })
  bookingId: string;

  @ApiPropertyOptional({
    description:
      'Payment instrument selected by customer (e.g., CARD, UPI, NETBANKING).',
    enum: PaymentMethod,
    example: PaymentMethod.CARD,
  })
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @ApiPropertyOptional({
    description:
      'Deterministic mock testing trigger: set to SUCCESS or FAILED to simulate gateway outcome.',
    enum: ['SUCCESS', 'FAILED'],
    example: 'SUCCESS',
  })
  @IsOptional()
  @IsIn(['SUCCESS', 'FAILED'], {
    message: 'simulateResult must be either SUCCESS or FAILED',
  })
  simulateResult?: 'SUCCESS' | 'FAILED';

  @ApiPropertyOptional({
    description: 'Custom simulated failure reason string for test assertions.',
    example: 'Card declined: Insufficient funds',
  })
  @IsOptional()
  @IsString()
  simulateFailureReason?: string;
}
