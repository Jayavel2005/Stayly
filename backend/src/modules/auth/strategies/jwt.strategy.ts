import { Injectable, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../prisma/prisma.service';
import { DomainException } from '../../../common/exceptions/domain.exception';
import { JwtPayload } from '../types/jwt-payload.type';
import { AuthenticatedUser } from '../types/authenticated-user.type';
import { UserStatus } from '../types/user-role.enum';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const secret =
      configService.get<string>('jwt.secret') ||
      process.env.JWT_SECRET ||
      'development_jwt_secret_key_change_in_production';

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        ExtractJwt.fromUrlQueryParameter('token'),
      ]),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (!payload?.sub) {
      throw new DomainException(
        'INVALID_TOKEN',
        'Invalid authentication token claims.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Authoritative Database Liveness & Account State Check
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        deletedAt: true,
      },
    });

    if (!user) {
      throw new DomainException(
        'INVALID_TOKEN',
        'User account associated with this token no longer exists.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (user.deletedAt !== null) {
      throw new DomainException(
        'ACCOUNT_DEACTIVATED',
        'User account has been deactivated.',
        HttpStatus.FORBIDDEN,
      );
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw new DomainException(
        'ACCOUNT_SUSPENDED',
        'User account is suspended. Please contact customer support.',
        HttpStatus.FORBIDDEN,
      );
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new DomainException(
        'ACCOUNT_INACTIVE',
        `User account is not active (${user.status}).`,
        HttpStatus.FORBIDDEN,
      );
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
    };
  }
}
