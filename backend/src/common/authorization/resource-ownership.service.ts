import { Injectable, HttpStatus } from '@nestjs/common';
import { DomainException } from '../exceptions/domain.exception';
import { AuthenticatedUser } from '../../modules/auth/types/authenticated-user.type';
import { UserRole } from '../../modules/auth/types/user-role.enum';

@Injectable()
export class ResourceOwnershipService {
  /**
   * Asserts that the authenticated user matches the owner ID of a resource.
   */
  assertOwnership(
    authenticatedUserId: string,
    resourceOwnerId: string,
    customMessage?: string,
  ): void {
    if (authenticatedUserId !== resourceOwnerId) {
      throw new DomainException(
        'FORBIDDEN',
        customMessage || 'You do not have permission to access this resource.',
        HttpStatus.FORBIDDEN,
      );
    }
  }

  /**
   * Asserts that the authenticated user is either the owner of the resource
   * or possesses the ADMIN platform role.
   */
  assertOwnerOrAdmin(
    user: AuthenticatedUser,
    resourceOwnerId: string,
    customMessage?: string,
  ): void {
    if (user.role === UserRole.ADMIN) {
      return;
    }

    if (user.id !== resourceOwnerId) {
      throw new DomainException(
        'FORBIDDEN',
        customMessage || 'You do not have permission to access this resource.',
        HttpStatus.FORBIDDEN,
      );
    }
  }
}
