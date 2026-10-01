export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');

export interface ProcessPaymentInput {
  paymentId: string;
  attemptId: string;
  bookingId: string;
  amountCents: bigint;
  currency: string;
  paymentMethod?: string;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
  /** Optional deterministic simulator outcome for testing */
  simulateResult?: 'SUCCESS' | 'FAILED';
  /** Optional failure reason simulation for testing */
  simulateFailureReason?: string;
}

export interface GatewayPaymentResult {
  success: boolean;
  gatewayReference: string;
  failureReason?: string;
  rawGatewayResponse?: Record<string, unknown>;
}

export interface PaymentGateway {
  /**
   * Processes a payment attempt with the gateway provider.
   * Must not throw network exceptions to the domain layer; returns structured result.
   */
  processPayment(input: ProcessPaymentInput): Promise<GatewayPaymentResult>;

  /**
   * Optional verification of a settled or pending transaction reference.
   */
  verifyPayment?(gatewayReference: string): Promise<GatewayPaymentResult>;
}
