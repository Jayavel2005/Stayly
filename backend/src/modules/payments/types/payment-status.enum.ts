export enum PaymentStatus {
  PENDING = 'PENDING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
  PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED',
}

export enum PaymentAttemptStatus {
  CREATED = 'CREATED',
  PROCESSING = 'PROCESSING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
}

export enum GatewayProvider {
  MOCK = 'MOCK',
}

export enum PaymentMethod {
  CARD = 'CARD',
  UPI = 'UPI',
  NETBANKING = 'NETBANKING',
  WALLET = 'WALLET',
}
