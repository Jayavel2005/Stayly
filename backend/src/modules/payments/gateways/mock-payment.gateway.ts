import { Injectable, Logger } from '@nestjs/common';
import {
  PaymentGateway,
  ProcessPaymentInput,
  GatewayPaymentResult,
} from './payment-gateway.interface';

@Injectable()
export class MockPaymentGateway implements PaymentGateway {
  private readonly logger = new Logger(MockPaymentGateway.name);

  async processPayment(
    input: ProcessPaymentInput,
  ): Promise<GatewayPaymentResult> {
    const reference = `MOCK-TXN-${Date.now()}-${input.attemptId.slice(0, 8).toUpperCase()}`;

    // 1. Explicit deterministic simulation override via input (for unit/e2e testing)
    if (input.simulateResult === 'FAILED') {
      const failureReason =
        input.simulateFailureReason ||
        'Card declined: Insufficient funds simulated by MockPaymentGateway';
      this.logger.debug(
        `[MockPaymentGateway] Simulated FAILURE for attempt ${input.attemptId}: ${failureReason}`,
      );
      return {
        success: false,
        gatewayReference: reference,
        failureReason,
        rawGatewayResponse: {
          code: 'PAYMENT_DECLINED',
          reference,
          attemptId: input.attemptId,
        },
      };
    }

    if (input.simulateResult === 'SUCCESS') {
      this.logger.debug(
        `[MockPaymentGateway] Simulated SUCCESS for attempt ${input.attemptId}`,
      );
      return {
        success: true,
        gatewayReference: reference,
        rawGatewayResponse: {
          code: 'PAYMENT_APPROVED',
          reference,
          attemptId: input.attemptId,
        },
      };
    }

    // 2. Deterministic simulation based on paymentMethod or idempotencyKey pattern
    if (
      input.paymentMethod === 'SIMULATE_FAILURE' ||
      input.idempotencyKey.toUpperCase().includes('FAIL')
    ) {
      const failureReason =
        input.simulateFailureReason ||
        'Card declined: Card network rejected payment simulated by MockPaymentGateway';
      this.logger.debug(
        `[MockPaymentGateway] Deterministic FAILURE trigger matched for attempt ${input.attemptId}: ${failureReason}`,
      );
      return {
        success: false,
        gatewayReference: reference,
        failureReason,
        rawGatewayResponse: {
          code: 'PAYMENT_DECLINED',
          reference,
          attemptId: input.attemptId,
        },
      };
    }

    // 3. Default deterministic mock behavior: SUCCESS
    this.logger.debug(
      `[MockPaymentGateway] Processed payment successfully for attempt ${input.attemptId} with reference ${reference}`,
    );
    return {
      success: true,
      gatewayReference: reference,
      rawGatewayResponse: {
        code: 'PAYMENT_APPROVED',
        reference,
        attemptId: input.attemptId,
      },
    };
  }

  async verifyPayment(gatewayReference: string): Promise<GatewayPaymentResult> {
    const isFailed = gatewayReference.includes('FAIL');
    return {
      success: !isFailed,
      gatewayReference,
      failureReason: isFailed ? 'Transaction verification failed' : undefined,
    };
  }
}
