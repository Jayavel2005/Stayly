import { HttpStatus } from '@nestjs/common';
import { ResourceOwnershipService } from './resource-ownership.service';
import { DomainException } from '../exceptions/domain.exception';
import { UserRole } from '../../modules/auth/types/user-role.enum';

describe('ResourceOwnershipService Unit Tests', () => {
  let service: ResourceOwnershipService;

  beforeEach(() => {
    service = new ResourceOwnershipService();
  });

  describe('assertOwnership', () => {
    it('should allow access when authenticated user ID matches resource owner ID', () => {
      expect(() =>
        service.assertOwnership('user-1', 'user-1'),
      ).not.toThrow();
    });

    it('should throw 403 FORBIDDEN when user ID does not match owner ID', () => {
      expect(() =>
        service.assertOwnership('user-1', 'user-2'),
      ).toThrow(DomainException);

      try {
        service.assertOwnership('user-1', 'user-2');
      } catch (err: any) {
        expect(err.getStatus()).toBe(HttpStatus.FORBIDDEN);
        expect(err.code).toBe('FORBIDDEN');
      }
    });
  });

  describe('assertOwnerOrAdmin', () => {
    it('should allow owner access', () => {
      expect(() =>
        service.assertOwnerOrAdmin(
          { id: 'user-1', email: 'u1@stayora.com', role: UserRole.CUSTOMER, status: 'ACTIVE' },
          'user-1',
        ),
      ).not.toThrow();
    });

    it('should allow ADMIN access to non-owned resource', () => {
      expect(() =>
        service.assertOwnerOrAdmin(
          { id: 'admin-1', email: 'admin@stayora.com', role: UserRole.ADMIN, status: 'ACTIVE' },
          'user-999',
        ),
      ).not.toThrow();
    });

    it('should reject non-admin non-owner with 403 FORBIDDEN', () => {
      expect(() =>
        service.assertOwnerOrAdmin(
          { id: 'user-1', email: 'u1@stayora.com', role: UserRole.CUSTOMER, status: 'ACTIVE' },
          'user-2',
        ),
      ).toThrow(DomainException);
    });
  });
});
