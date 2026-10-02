/**
 * Stayora Shared Types & API Contracts
 * Aligned with README.md API Architecture & DATABASE_ARCHITECTURE.md
 */

export type UserRole = 'CUSTOMER' | 'MANAGER' | 'ADMIN';

export type LoyaltyTier = 'Silver Guest' | 'Gold Tier' | 'Platinum Sanctuary';

export interface CustomerUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: 'CUSTOMER';
  avatarUrl?: string;
  loyaltyTier?: LoyaltyTier;
  createdAt: string;
  updatedAt?: string;
}

export interface AuthTokens {
  accessToken: string; // 15-minute JWT with role claims
  refreshToken: string; // 7-day hashed token
  tokenType: 'Bearer';
  expiresIn: number; // 900 seconds (15 minutes)
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponseData {
  user: CustomerUser;
  tokens: AuthTokens;
}

export interface ApiErrorDetail {
  field?: string;
  reason: string;
}

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: ApiErrorDetail[];
  retryAfterSeconds?: number;
}

export interface StandardApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiErrorPayload;
  timestamp?: string;
  path?: string;
}
