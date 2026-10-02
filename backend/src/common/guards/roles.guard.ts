import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserRole } from '../../modules/auth/types/user-role.enum';
import { AuthenticatedUser } from '../../modules/auth/types/authenticated-user.type';
import { DomainException } from '../exceptions/domain.exception';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<(UserRole | string)[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no specific roles are required, allow request to proceed
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;

    // Authentication must precede role authorization
    if (!user) {
      throw new DomainException(
        'UNAUTHORIZED',
        'Authentication required to access this resource.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const userRole = user.role;

    // Check if user's role matches ANY required role (OR semantics)
    const hasRole = requiredRoles.some((requiredRole) => {
      if (
        (requiredRole === UserRole.HOTEL_MANAGER || requiredRole === 'MANAGER') &&
        (userRole === 'HOTEL_MANAGER' || userRole === 'MANAGER')
      ) {
        return true;
      }
      return userRole === requiredRole;
    });

    if (!hasRole) {
      throw new DomainException(
        'FORBIDDEN',
        'You do not have permission to access this resource.',
        HttpStatus.FORBIDDEN,
      );
    }

    return true;
  }
}
