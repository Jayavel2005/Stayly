import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../modules/auth/types/user-role.enum';

export const ROLES_KEY = 'roles';

/**
 * Decorator to attach authorized roles to a handler or controller class.
 * Specifying multiple roles grants access to ANY of the specified roles (OR logic).
 *
 * Example:
 * @Roles(UserRole.ADMIN)
 * @Roles(UserRole.HOTEL_MANAGER, UserRole.ADMIN)
 */
export const Roles = (...roles: (UserRole | string)[]) =>
  SetMetadata(ROLES_KEY, roles);
