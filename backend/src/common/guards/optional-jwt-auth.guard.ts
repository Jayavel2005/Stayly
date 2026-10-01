import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthenticatedUser } from '../../modules/auth/types/authenticated-user.type';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = AuthenticatedUser>(
    err: unknown,
    user: TUser | false,
  ): TUser | null {
    if (err || !user) {
      return null as any;
    }
    return user;
  }
}
