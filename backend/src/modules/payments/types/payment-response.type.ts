import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentStatus, PaymentAttemptStatus } from './payment-status.enum';

export class PaymentAttemptResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id: string;

  @ApiProperty({ example: 1 })
  attemptNumber: number;

  @ApiProperty({ example: 'IDEMP-8c4c6f4e-202610-001' })
  idempotencyKey: string;

  @ApiProperty({ example: '13500.00' })
  amount: string;

  @ApiProperty({ example: 'INR' })
  currency: string;

  @ApiProperty({ enum: PaymentAttemptStatus, example: PaymentAttemptStatus.SUCCEEDED })
  status: PaymentAttemptStatus | string;

  @ApiProperty({ example: 'MOCK' })
  gatewayProvider: string;

  @ApiPropertyOptional({ example: 'MOCK-TXN-1727800000000-A1B2C3D4' })
  gatewayReference?: string | null;

  @ApiPropertyOptional({ example: 'CARD' })
  paymentMethod?: string | null;

  @ApiPropertyOptional({ example: 'Insufficient funds' })
  failureReason?: string | null;

  @ApiProperty({ example: '2026-10-01T12:00:00.000Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-10-01T12:00:01.000Z' })
  updatedAt: string;
}

export class PaymentResponseDto {
  @ApiProperty({ example: '7d549d09-7d54-4c2a-86a1-06aa54d2513e' })
  id: string;

  @ApiProperty({ example: '10594466-e472-4e5b-887f-1e624e255292' })
  bookingId: string;

  @ApiPropertyOptional({ example: 'STY-202610-0001' })
  bookingReference?: string;

  @ApiProperty({ example: 'TXN-MOCK-202610-001' })
  transactionReference: string;

  @ApiProperty({ enum: PaymentStatus, example: PaymentStatus.SUCCEEDED })
  status: PaymentStatus | string;

  @ApiProperty({ example: '13500.00' })
  amount: string;

  @ApiProperty({ example: 'INR' })
  currency: string;

  @ApiProperty({ example: 'MOCK' })
  gatewayProvider: string;

  @ApiPropertyOptional({ example: 'CARD' })
  paymentMethod?: string | null;

  @ApiPropertyOptional({ example: null })
  failureReason?: string | null;

  @ApiPropertyOptional({ example: '2026-10-01T12:00:01.000Z' })
  settledAt?: string | null;

  @ApiProperty({ example: '2026-10-01T12:00:00.000Z' })
  createdAt: string;

  @ApiProperty({ type: [PaymentAttemptResponseDto] })
  attempts: PaymentAttemptResponseDto[];
}
