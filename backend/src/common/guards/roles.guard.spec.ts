import { ExecutionContext, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { UserRole } from '../../modules/auth/types/user-role.enum';
import { DomainException } from '../exceptions/domain.exception';

describe('RolesGuard Unit Tests', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  const createMockContext = (
    user?: { id: string; role: string },
  ): ExecutionContext => {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it('should allow access if route has no @Roles decorator', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

    const context = createMockContext({ id: 'u1', role: UserRole.CUSTOMER });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should throw 401 UNAUTHORIZED if user is not authenticated', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([UserRole.ADMIN]);

    const context = createMockContext(undefined);

    expect(() => guard.canActivate(context)).toThrow(DomainException);
    try {
      guard.canActivate(context);
    } catch (err: any) {
      expect(err.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
      expect(err.code).toBe('UNAUTHORIZED');
    }
  });

  it('should allow access if user has the single required role', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([UserRole.ADMIN]);

    const context = createMockContext({ id: 'u1', role: UserRole.ADMIN });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should throw 403 FORBIDDEN if user has insufficient role', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([UserRole.ADMIN]);

    const context = createMockContext({ id: 'u1', role: UserRole.CUSTOMER });

    expect(() => guard.canActivate(context)).toThrow(DomainException);
    try {
      guard.canActivate(context);
    } catch (err: any) {
      expect(err.getStatus()).toBe(HttpStatus.FORBIDDEN);
      expect(err.code).toBe('FORBIDDEN');
    }
  });

  it('should support multiple roles (OR semantics): allow MANAGER or ADMIN, reject CUSTOMER', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([UserRole.HOTEL_MANAGER, UserRole.ADMIN]);

    // Manager should be allowed
    const managerContext = createMockContext({
      id: 'u1',
      role: UserRole.HOTEL_MANAGER,
    });
    expect(guard.canActivate(managerContext)).toBe(true);

    // Admin should be allowed
    const adminContext = createMockContext({ id: 'u2', role: UserRole.ADMIN });
    expect(guard.canActivate(adminContext)).toBe(true);

    // Customer should be rejected
    const customerContext = createMockContext({
      id: 'u3',
      role: UserRole.CUSTOMER,
    });
    expect(() => guard.canActivate(customerContext)).toThrow(DomainException);
  });

  it('should treat MANAGER and HOTEL_MANAGER as compatible aliases', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['MANAGER']);

    const context = createMockContext({
      id: 'u1',
      role: UserRole.HOTEL_MANAGER,
    });
    expect(guard.canActivate(context)).toBe(true);
  });
});
