export interface SafeUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  role: string;
  status: string;
  createdAt: string | Date;
}

export interface AuthResponse {
  user: SafeUser;
  accessToken: string;
  expiresIn: string;
}
