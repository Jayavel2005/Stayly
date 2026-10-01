import { Injectable, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { DomainException } from '../../common/exceptions/domain.exception';
import { CustomerRegisterDto } from './dto/customer-register.dto';
import { CustomerLoginDto } from './dto/customer-login.dto';
import { ManagerLoginDto } from './dto/manager-login.dto';
import { AdminLoginDto } from './dto/admin-login.dto';
import { UserRole, UserStatus } from './types/user-role.enum';
import { SafeUser, AuthResponse } from './types/auth-response.type';
import { JwtPayload } from './types/jwt-payload.type';

@Injectable()
export class AuthService {
  private readonly jwtExpiresIn: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.jwtExpiresIn =
      this.configService.get<string>('jwt.expiresIn') ||
      process.env.JWT_EXPIRES_IN ||
      '15m';
  }

  /**
   * Register a new customer account.
   * Enforces role = CUSTOMER at the domain level, strictly preventing privilege escalation.
   */
  async registerCustomer(dto: CustomerRegisterDto): Promise<AuthResponse> {
    const email = dto.email.toLowerCase().trim();

    // Resolve first and last names
    let firstName = dto.firstName?.trim() || '';
    let lastName = dto.lastName?.trim() || '';

    if (dto.name && !firstName) {
      const parts = dto.name.trim().split(/\s+/);
      firstName = parts[0] || 'Customer';
      lastName = parts.slice(1).join(' ');
    }

    if (!firstName) {
      firstName = 'Customer';
    }

    // Cryptographic Password Hashing (bcrypt, 10 rounds)
    const passwordHash = await bcrypt.hash(dto.password, 10);

    try {
      const user = await this.prisma.user.create({
        data: {
          email,
          passwordHash,
          firstName,
          lastName,
          phone: dto.phone?.trim() || null,
          role: UserRole.CUSTOMER, // Authoritative invariant: public registration creates CUSTOMER only
          status: UserStatus.ACTIVE,
        },
      });

      const safeUser = this.toSafeUser(user);
      const token = await this.generateToken(safeUser);

      return {
        user: safeUser,
        accessToken: token.accessToken,
        expiresIn: token.expiresIn,
      };
    } catch (error) {
      // PostgreSQL Unique Constraint Violation on idx_users_active_email
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new DomainException(
          'EMAIL_ALREADY_REGISTERED',
          'An account with this email address already exists.',
          HttpStatus.CONFLICT,
        );
      }
      throw error;
    }
  }

  /**
   * Customer portal login (localhost:3000).
   * Restricts access strictly to accounts with role = CUSTOMER.
   */
  async loginCustomer(dto: CustomerLoginDto): Promise<AuthResponse> {
    return this.authenticateWithRole(
      dto.email,
      dto.password,
      UserRole.CUSTOMER,
      'Customer',
    );
  }

  /**
   * Manager portal login (localhost:3001).
   * Restricts access strictly to accounts with role = HOTEL_MANAGER.
   */
  async loginManager(dto: ManagerLoginDto): Promise<AuthResponse> {
    return this.authenticateWithRole(
      dto.email,
      dto.password,
      UserRole.HOTEL_MANAGER,
      'Hotel Manager',
    );
  }

  /**
   * Admin portal login (localhost:3002).
   * Restricts access strictly to accounts with role = ADMIN.
   */
  async loginAdmin(dto: AdminLoginDto): Promise<AuthResponse> {
    return this.authenticateWithRole(
      dto.email,
      dto.password,
      UserRole.ADMIN,
      'Administrator',
    );
  }

  /**
   * Central reusable authentication and role-compatibility engine.
   */
  private async authenticateWithRole(
    emailInput: string,
    passwordInput: string,
    expectedRole: UserRole,
    portalName: string,
  ): Promise<AuthResponse> {
    const email = emailInput.toLowerCase().trim();

    // 1. Find user by email (only non-deleted accounts)
    const user = await this.prisma.user.findFirst({
      where: {
        email,
        deletedAt: null,
      },
    });

    // Uniform authentication failure response (no user enumeration leak)
    if (!user) {
      throw new DomainException(
        'INVALID_CREDENTIALS',
        'Invalid email or password.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    // 2. Verify password hash
    const isPasswordValid = await bcrypt.compare(
      passwordInput,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new DomainException(
        'INVALID_CREDENTIALS',
        'Invalid email or password.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    // 3. Verify Account Status
    if (user.status === UserStatus.SUSPENDED) {
      throw new DomainException(
        'ACCOUNT_SUSPENDED',
        'Account is suspended. Please contact customer support.',
        HttpStatus.FORBIDDEN,
      );
    }

    if (user.status === UserStatus.PENDING_VERIFICATION) {
      throw new DomainException(
        'ACCOUNT_PENDING_VERIFICATION',
        'Account verification is pending.',
        HttpStatus.FORBIDDEN,
      );
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new DomainException(
        'ACCOUNT_INACTIVE',
        `Account is currently ${user.status.toLowerCase()}. Please contact support.`,
        HttpStatus.FORBIDDEN,
      );
    }

    // 4. Role Compatibility Check across separate frontend portals
    const isRoleCompatible =
      expectedRole === UserRole.HOTEL_MANAGER
        ? user.role === 'HOTEL_MANAGER' || user.role === 'MANAGER'
        : user.role === expectedRole;

    if (!isRoleCompatible) {
      throw new DomainException(
        'INVALID_APPLICATION_ROLE',
        `Access denied. This portal is restricted to ${portalName} accounts.`,
        HttpStatus.FORBIDDEN,
      );
    }

    const safeUser = this.toSafeUser(user);
    const token = await this.generateToken(safeUser);

    return {
      user: safeUser,
      accessToken: token.accessToken,
      expiresIn: token.expiresIn,
    };
  }

  /**
   * Fetch current authenticated user by user ID.
   */
  async getCurrentUser(userId: string): Promise<SafeUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.deletedAt !== null) {
      throw new DomainException(
        'NOT_FOUND',
        'User account not found.',
        HttpStatus.NOT_FOUND,
      );
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw new DomainException(
        'ACCOUNT_SUSPENDED',
        'Account is suspended.',
        HttpStatus.FORBIDDEN,
      );
    }

    return this.toSafeUser(user);
  }

  /**
   * Stateless client-side token discard acknowledgement.
   */
  async logout(): Promise<{ message: string }> {
    return {
      message: 'Successfully logged out. Client token discarded.',
    };
  }

  /**
   * Generate signed JWT access token containing minimal claims.
   */
  private async generateToken(
    user: SafeUser,
  ): Promise<{ accessToken: string; expiresIn: string }> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      expiresIn: this.jwtExpiresIn,
    };
  }

  /**
   * Strips passwordHash and internal attributes to ensure zero credential leakage.
   */
  private toSafeUser(user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone?: string | null;
    role: string;
    status: string;
    createdAt: Date;
  }): SafeUser {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone ?? null,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
    };
  }
}
