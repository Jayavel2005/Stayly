import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRole, UserStatus } from './types/user-role.enum';
import { DomainException } from '../../common/exceptions/domain.exception';
import * as bcrypt from 'bcrypt';

describe('AuthService Unit Tests', () => {
  let authService: AuthService;
  let prismaService: any;
  let jwtService: any;
  let configService: any;

  const mockCustomer = {
    id: 'user-cust-123',
    email: 'customer@stayora.com',
    passwordHash: '',
    firstName: 'Aarav',
    lastName: 'Sharma',
    phone: '+919876543210',
    role: UserRole.CUSTOMER,
    status: UserStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockManager = {
    id: 'user-mgr-123',
    email: 'manager@stayora.com',
    passwordHash: '',
    firstName: 'Vikram',
    lastName: 'Malhotra',
    phone: '+919876543211',
    role: UserRole.HOTEL_MANAGER,
    status: UserStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockAdmin = {
    id: 'user-adm-123',
    email: 'admin@stayora.com',
    passwordHash: '',
    firstName: 'Priya',
    lastName: 'Nair',
    phone: '+919876543212',
    role: UserRole.ADMIN,
    status: UserStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeAll(async () => {
    const rawPass = 'Password123!';
    const hash = await bcrypt.hash(rawPass, 10);
    mockCustomer.passwordHash = hash;
    mockManager.passwordHash = hash;
    mockAdmin.passwordHash = hash;
  });

  beforeEach(async () => {
    prismaService = {
      user: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
    };

    jwtService = {
      signAsync: jest.fn().mockResolvedValue('mocked.jwt.token'),
    };

    configService = {
      get: jest.fn((key: string, defaultVal: string) => {
        if (key === 'jwt.expiresIn') return '15m';
        return defaultVal;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaService },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
  });

  describe('Customer Registration', () => {
    it('should create customer account with role=CUSTOMER and omit passwordHash', async () => {
      prismaService.user.create.mockResolvedValue(mockCustomer);

      const result = await authService.registerCustomer({
        email: 'customer@stayora.com',
        password: 'Password123!',
        firstName: 'Aarav',
        lastName: 'Sharma',
      });

      expect(prismaService.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'customer@stayora.com',
          role: UserRole.CUSTOMER,
          status: UserStatus.ACTIVE,
        }),
      });

      expect(result.user.email).toBe('customer@stayora.com');
      expect(result.user.role).toBe(UserRole.CUSTOMER);
      expect((result.user as any).passwordHash).toBeUndefined();
      expect(result.accessToken).toBe('mocked.jwt.token');
    });

    it('should handle name splitting when full name is passed', async () => {
      prismaService.user.create.mockResolvedValue({
        ...mockCustomer,
        firstName: 'John',
        lastName: 'Doe',
      });

      await authService.registerCustomer({
        email: 'john@example.com',
        password: 'Password123!',
        name: 'John Doe',
      });

      expect(prismaService.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          firstName: 'John',
          lastName: 'Doe',
        }),
      });
    });
  });

  describe('Cross-Portal Login Isolation', () => {
    it('should allow customer to login to customer portal', async () => {
      prismaService.user.findFirst.mockResolvedValue(mockCustomer);

      const result = await authService.loginCustomer({
        email: 'customer@stayora.com',
        password: 'Password123!',
      });

      expect(result.user.role).toBe(UserRole.CUSTOMER);
      expect(result.accessToken).toBe('mocked.jwt.token');
    });

    it('should REJECT manager attempting to login through customer portal', async () => {
      prismaService.user.findFirst.mockResolvedValue(mockManager);

      await expect(
        authService.loginCustomer({
          email: 'manager@stayora.com',
          password: 'Password123!',
        }),
      ).rejects.toThrow(DomainException);

      try {
        await authService.loginCustomer({
          email: 'manager@stayora.com',
          password: 'Password123!',
        });
      } catch (err: any) {
        expect(err.code).toBe('INVALID_APPLICATION_ROLE');
      }
    });

    it('should REJECT admin attempting to login through customer portal', async () => {
      prismaService.user.findFirst.mockResolvedValue(mockAdmin);

      await expect(
        authService.loginCustomer({
          email: 'admin@stayora.com',
          password: 'Password123!',
        }),
      ).rejects.toThrow(DomainException);
    });

    it('should allow manager to login to manager portal', async () => {
      prismaService.user.findFirst.mockResolvedValue(mockManager);

      const result = await authService.loginManager({
        email: 'manager@stayora.com',
        password: 'Password123!',
      });

      expect(result.user.role).toBe(UserRole.HOTEL_MANAGER);
    });

    it('should REJECT customer attempting to login through manager portal', async () => {
      prismaService.user.findFirst.mockResolvedValue(mockCustomer);

      await expect(
        authService.loginManager({
          email: 'customer@stayora.com',
          password: 'Password123!',
        }),
      ).rejects.toThrow(DomainException);
    });

    it('should allow admin to login to admin portal', async () => {
      prismaService.user.findFirst.mockResolvedValue(mockAdmin);

      const result = await authService.loginAdmin({
        email: 'admin@stayora.com',
        password: 'Password123!',
      });

      expect(result.user.role).toBe(UserRole.ADMIN);
    });

    it('should REJECT customer attempting to login through admin portal', async () => {
      prismaService.user.findFirst.mockResolvedValue(mockCustomer);

      await expect(
        authService.loginAdmin({
          email: 'customer@stayora.com',
          password: 'Password123!',
        }),
      ).rejects.toThrow(DomainException);
    });
  });

  describe('Security & Account Status Handling', () => {
    it('should reject wrong password with generic INVALID_CREDENTIALS', async () => {
      prismaService.user.findFirst.mockResolvedValue(mockCustomer);

      await expect(
        authService.loginCustomer({
          email: 'customer@stayora.com',
          password: 'WrongPassword!',
        }),
      ).rejects.toThrow(DomainException);

      try {
        await authService.loginCustomer({
          email: 'customer@stayora.com',
          password: 'WrongPassword!',
        });
      } catch (err: any) {
        expect(err.code).toBe('INVALID_CREDENTIALS');
      }
    });

    it('should reject non-existent user with identical INVALID_CREDENTIALS', async () => {
      prismaService.user.findFirst.mockResolvedValue(null);

      try {
        await authService.loginCustomer({
          email: 'nonexistent@stayora.com',
          password: 'Password123!',
        });
      } catch (err: any) {
        expect(err.code).toBe('INVALID_CREDENTIALS');
      }
    });

    it('should reject suspended user with ACCOUNT_SUSPENDED', async () => {
      prismaService.user.findFirst.mockResolvedValue({
        ...mockCustomer,
        status: UserStatus.SUSPENDED,
      });

      try {
        await authService.loginCustomer({
          email: 'customer@stayora.com',
          password: 'Password123!',
        });
      } catch (err: any) {
        expect(err.code).toBe('ACCOUNT_SUSPENDED');
      }
    });
  });

  describe('Current User Retrieval', () => {
    it('should retrieve safe current user profile without passwordHash', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockCustomer);

      const user = await authService.getCurrentUser(mockCustomer.id);
      expect(user.id).toBe(mockCustomer.id);
      expect(user.email).toBe(mockCustomer.email);
      expect((user as any).passwordHash).toBeUndefined();
    });
  });
});
