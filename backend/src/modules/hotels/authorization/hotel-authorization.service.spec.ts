import { HttpStatus } from '@nestjs/common';
import { HotelAuthorizationService } from './hotel-authorization.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { DomainException } from '../../../common/exceptions/domain.exception';
import { UserRole } from '../../auth/types/user-role.enum';

describe('HotelAuthorizationService Unit Tests', () => {
  let service: HotelAuthorizationService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      hotel: {
        findFirst: jest.fn(),
      },
      hotelManager: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
    };

    service = new HotelAuthorizationService(prisma as PrismaService);
  });

  describe('assertManagerAccess', () => {
    it('should throw 404 NOT_FOUND if hotel does not exist', async () => {
      prisma.hotel.findFirst.mockResolvedValue(null);

      await expect(
        service.assertManagerAccess('mgr-1', 'nonexistent-hotel'),
      ).rejects.toThrow(DomainException);

      try {
        await service.assertManagerAccess('mgr-1', 'nonexistent-hotel');
      } catch (err: any) {
        expect(err.getStatus()).toBe(HttpStatus.NOT_FOUND);
        expect(err.code).toBe('NOT_FOUND');
      }
    });

    it('should allow access if manager is assigned to the hotel in hotel_managers', async () => {
      prisma.hotel.findFirst.mockResolvedValue({ id: 'hotel-1' });
      prisma.hotelManager.findUnique.mockResolvedValue({
        userId: 'mgr-1',
        hotelId: 'hotel-1',
        isPrimary: true,
      });

      await expect(
        service.assertManagerAccess('mgr-1', 'hotel-1'),
      ).resolves.toBeUndefined();
    });

    it('should throw 403 FORBIDDEN if manager is NOT assigned to the hotel', async () => {
      prisma.hotel.findFirst.mockResolvedValue({ id: 'hotel-2' });
      prisma.hotelManager.findUnique.mockResolvedValue(null);

      await expect(
        service.assertManagerAccess('mgr-1', 'hotel-2'),
      ).rejects.toThrow(DomainException);

      try {
        await service.assertManagerAccess('mgr-1', 'hotel-2');
      } catch (err: any) {
        expect(err.getStatus()).toBe(HttpStatus.FORBIDDEN);
        expect(err.code).toBe('FORBIDDEN');
      }
    });

    it('should throw 404 NOT_FOUND when hideExistence option is enabled', async () => {
      prisma.hotel.findFirst.mockResolvedValue({ id: 'hotel-2' });
      prisma.hotelManager.findUnique.mockResolvedValue(null);

      await expect(
        service.assertManagerAccess('mgr-1', 'hotel-2', { hideExistence: true }),
      ).rejects.toThrow(DomainException);

      try {
        await service.assertManagerAccess('mgr-1', 'hotel-2', {
          hideExistence: true,
        });
      } catch (err: any) {
        expect(err.getStatus()).toBe(HttpStatus.NOT_FOUND);
      }
    });
  });

  describe('canManagerAccessHotel', () => {
    it('should return true when manager is assigned and hotel exists', async () => {
      prisma.hotel.findFirst.mockResolvedValue({ id: 'hotel-1' });
      prisma.hotelManager.findUnique.mockResolvedValue({
        userId: 'mgr-1',
        hotelId: 'hotel-1',
      });

      const canAccess = await service.canManagerAccessHotel('mgr-1', 'hotel-1');
      expect(canAccess).toBe(true);
    });

    it('should return false when manager is not assigned', async () => {
      prisma.hotel.findFirst.mockResolvedValue({ id: 'hotel-2' });
      prisma.hotelManager.findUnique.mockResolvedValue(null);

      const canAccess = await service.canManagerAccessHotel('mgr-1', 'hotel-2');
      expect(canAccess).toBe(false);
    });
  });

  describe('getManagedHotelIds', () => {
    it('should return array of assigned hotel IDs', async () => {
      prisma.hotelManager.findMany.mockResolvedValue([
        { hotelId: 'h-1' },
        { hotelId: 'h-2' },
      ]);

      const ids = await service.getManagedHotelIds('mgr-1');
      expect(ids).toEqual(['h-1', 'h-2']);
    });
  });

  describe('assertAdminOrManagerAccess', () => {
    it('should allow ADMIN unconditionally if hotel exists', async () => {
      prisma.hotel.findFirst.mockResolvedValue({ id: 'hotel-1' });

      await expect(
        service.assertAdminOrManagerAccess(
          { id: 'admin-1', email: 'admin@stayora.com', role: UserRole.ADMIN, status: 'ACTIVE' },
          'hotel-1',
        ),
      ).resolves.toBeUndefined();
    });

    it('should enforce manager assignment for HOTEL_MANAGER', async () => {
      prisma.hotel.findFirst.mockResolvedValue({ id: 'hotel-1' });
      prisma.hotelManager.findUnique.mockResolvedValue({
        userId: 'mgr-1',
        hotelId: 'hotel-1',
      });

      await expect(
        service.assertAdminOrManagerAccess(
          { id: 'mgr-1', email: 'mgr@stayora.com', role: UserRole.HOTEL_MANAGER, status: 'ACTIVE' },
          'hotel-1',
        ),
      ).resolves.toBeUndefined();
    });

    it('should reject CUSTOMER role immediately', async () => {
      await expect(
        service.assertAdminOrManagerAccess(
          { id: 'cust-1', email: 'c@stayora.com', role: UserRole.CUSTOMER, status: 'ACTIVE' },
          'hotel-1',
        ),
      ).rejects.toThrow(DomainException);
    });
  });
});
