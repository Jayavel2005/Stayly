import { UserProfile } from './index';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  phone: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string; // 15-minute JWT
  refreshToken: string; // 7-day hashed token
}

export interface AuthResponseData {
  accessToken: string;
  refreshToken: string;
  user: UserProfile;
}

export interface ApiErrorDetail {
  field?: string;
  reason: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: 'VALIDATION_ERROR' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT' | 'RATE_LIMIT_EXCEEDED' | 'INTERNAL_SERVER_ERROR';
    message: string;
    details?: ApiErrorDetail[];
    retryAfterSeconds?: number;
  };
  timestamp: string;
  path: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    totalItems?: number;
    totalPages?: number;
  };
}
