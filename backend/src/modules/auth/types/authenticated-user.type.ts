import { UserRole } from './user-role.enum';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole | string;
  status: string;
}
