import {
  Injectable,
  ExecutionContext,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DomainException } from '../../../common/exceptions/domain.exception';
import { AuthenticatedUser } from '../types/authenticated-user.type';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = AuthenticatedUser>(
    err: unknown,
    user: TUser | false,
    info: unknown,
    _context: ExecutionContext,
  ): TUser {
    if (err instanceof DomainException) {
      throw err;
    }

    if (err) {
      throw new DomainException(
        'UNAUTHORIZED',
        err instanceof Error ? err.message : 'Authentication failed.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (info && typeof info === 'object' && 'name' in info) {
      const jwtError = info as { name: string; message: string };
      if (jwtError.name === 'TokenExpiredError') {
        throw new DomainException(
          'TOKEN_EXPIRED',
          'Authentication token has expired. Please sign in again.',
          HttpStatus.UNAUTHORIZED,
        );
      }
      if (jwtError.name === 'JsonWebTokenError') {
        throw new DomainException(
          'INVALID_TOKEN',
          'Invalid or malformed authentication token.',
          HttpStatus.UNAUTHORIZED,
        );
      }
    }

    if (!user) {
      throw new DomainException(
        'UNAUTHORIZED',
        'Authentication required. Please provide a valid Bearer token.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    return user;
  }
}
