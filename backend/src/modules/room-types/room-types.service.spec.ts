import { HttpStatus } from '@nestjs/common';
import { RoomTypesService } from './room-types.service';
import { HotelAuthorizationService } from '../hotels/authorization/hotel-authorization.service';
import { PrismaService } from '../../prisma/prisma.service';
import { DomainException } from '../../common/exceptions/domain.exception';
import { UserRole, UserStatus } from '../auth/types/user-role.enum';
import { RoomTypeSortBy, SortOrder } from './types/room-type-sort-by.enum';

describe('RoomTypesService Unit Tests', () => {
  let service: RoomTypesService;
  let prisma: any;
  let hotelAuthService: any;

  const mockAdmin = {
    id: 'admin-1',
    email: 'admin@stayora.com',
    role: UserRole.ADMIN,
    status: UserStatus.ACTIVE,
  };

  const mockManagerA = {
    id: 'manager-a',
    email: 'managerA@stayora.com',
    role: UserRole.HOTEL_MANAGER,
    status: UserStatus.ACTIVE,
  };

  const mockCustomer = {
    id: 'customer-1',
    email: 'guest@stayora.com',
    role: UserRole.CUSTOMER,
    status: UserStatus.ACTIVE,
  };

  const mockRoomType = {
    id: 'rt-100',
    hotelId: 'hotel-1',
    name: 'Deluxe Suite',
    slug: 'deluxe-suite',
    description: 'Luxurious room with ocean view',
    maxOccupancy: 3,
    maxAdults: 2,
    maxChildren: 1,
    basePriceCents: BigInt(500000),
    currency: 'INR',
    bedType: 'KING',
    sizeSqMeters: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    hotel: {
      id: 'hotel-1',
      name: 'Stayora Mumbai',
      city: 'Mumbai',
      country: 'India',
      isActive: true,
      deletedAt: null,
    },
    amenities: [],
  };

  beforeEach(() => {
    prisma = {
      roomType: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      room: {
        count: jest.fn(),
      },
    };

    hotelAuthService = {
      assertAdminOrManagerAccess: jest.fn(),
      assertManagerAccess: jest.fn(),
      getManagedHotelIds: jest.fn(),
    };

    service = new RoomTypesService(prisma as unknown as PrismaService, hotelAuthService as unknown as HotelAuthorizationService);
  });

  describe('createRoomType', () => {
    const dto = {
      hotelId: 'hotel-1',
      name: 'Deluxe Suite',
      description: 'Luxurious room with ocean view',
      maxOccupancy: 3,
      maxAdults: 2,
      maxChildren: 1,
      basePriceCents: 500000,
    };

    it('should allow ADMIN to create RoomType', async () => {
      hotelAuthService.assertAdminOrManagerAccess.mockResolvedValue(undefined);
      prisma.roomType.findUnique.mockResolvedValue(null);
      prisma.roomType.create.mockResolvedValue(mockRoomType);

      const result = await service.createRoomType(mockAdmin, dto);

      expect(hotelAuthService.assertAdminOrManagerAccess).toHaveBeenCalledWith(mockAdmin, 'hotel-1');
      expect(prisma.roomType.create).toHaveBeenCalled();
      expect(result).toEqual(mockRoomType);
    });

    it('should allow assigned HOTEL_MANAGER to create RoomType', async () => {
      hotelAuthService.assertAdminOrManagerAccess.mockResolvedValue(undefined);
      prisma.roomType.findUnique.mockResolvedValue(null);
      prisma.roomType.create.mockResolvedValue(mockRoomType);

      const result = await service.createRoomType(mockManagerA, dto);

      expect(hotelAuthService.assertAdminOrManagerAccess).toHaveBeenCalledWith(mockManagerA, 'hotel-1');
      expect(result).toEqual(mockRoomType);
    });

    it('should reject unassigned HOTEL_MANAGER with 403 Forbidden', async () => {
      hotelAuthService.assertAdminOrManagerAccess.mockRejectedValue(
        new DomainException('FORBIDDEN', 'Access denied.', HttpStatus.FORBIDDEN),
      );

      await expect(service.createRoomType(mockManagerA, dto)).rejects.toThrow(DomainException);
      expect(prisma.roomType.create).not.toHaveBeenCalled();
    });

    it('should reject when maxAdults exceeds maxOccupancy with 400 Bad Request', async () => {
      hotelAuthService.assertAdminOrManagerAccess.mockResolvedValue(undefined);

      await expect(
        service.createRoomType(mockAdmin, {
          ...dto,
          maxOccupancy: 2,
          maxAdults: 3,
        }),
      ).rejects.toThrow(DomainException);
    });

    it('should reject duplicate slug in the same hotel with 409 Conflict', async () => {
      hotelAuthService.assertAdminOrManagerAccess.mockResolvedValue(undefined);
      prisma.roomType.findUnique.mockResolvedValue(mockRoomType);

      await expect(service.createRoomType(mockAdmin, dto)).rejects.toThrow(DomainException);
    });
  });

  describe('findRoomTypes', () => {
    it('should return only active room types of active hotels for public/customer queries', async () => {
      prisma.roomType.count.mockResolvedValue(1);
      prisma.roomType.findMany.mockResolvedValue([mockRoomType]);

      const result = await service.findRoomTypes({ page: 1, limit: 20 }, mockCustomer);

      expect(prisma.roomType.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
            deletedAt: null,
            hotel: expect.objectContaining({ isActive: true, deletedAt: null }),
          }),
        }),
      );
      expect(result.items).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should scope room types to managed hotels when queried by manager', async () => {
      hotelAuthService.getManagedHotelIds.mockResolvedValue(['hotel-1', 'hotel-2']);
      prisma.roomType.count.mockResolvedValue(1);
      prisma.roomType.findMany.mockResolvedValue([mockRoomType]);

      await service.findRoomTypes({}, mockManagerA);

      expect(prisma.roomType.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            hotelId: { in: ['hotel-1', 'hotel-2'] },
          }),
        }),
      );
    });
  });

  describe('findRoomTypeById', () => {
    it('should return room type by ID', async () => {
      prisma.roomType.findFirst.mockResolvedValue(mockRoomType);

      const result = await service.findRoomTypeById('rt-100', mockAdmin);
      expect(result).toEqual(mockRoomType);
    });

    it('should throw 404 if room type is missing', async () => {
      prisma.roomType.findFirst.mockResolvedValue(null);

      await expect(service.findRoomTypeById('non-existent', mockAdmin)).rejects.toThrow(DomainException);
    });

    it('should throw 404 for customer if room type is inactive', async () => {
      prisma.roomType.findFirst.mockResolvedValue({
        ...mockRoomType,
        isActive: false,
      });

      await expect(service.findRoomTypeById('rt-100', mockCustomer)).rejects.toThrow(DomainException);
    });

    it('should verify manager access for hotel manager', async () => {
      prisma.roomType.findFirst.mockResolvedValue(mockRoomType);
      hotelAuthService.assertManagerAccess.mockResolvedValue(undefined);

      await service.findRoomTypeById('rt-100', mockManagerA);
      expect(hotelAuthService.assertManagerAccess).toHaveBeenCalledWith('manager-a', 'hotel-1');
    });
  });

  describe('deleteRoomType', () => {
    it('should reject deletion with 409 Conflict if active rooms exist', async () => {
      prisma.roomType.findFirst.mockResolvedValue(mockRoomType);
      hotelAuthService.assertAdminOrManagerAccess.mockResolvedValue(undefined);
      prisma.room.count.mockResolvedValue(5); // 5 physical rooms exist

      await expect(service.deleteRoomType('rt-100', mockAdmin)).rejects.toThrow(DomainException);
      expect(prisma.roomType.update).not.toHaveBeenCalled();
    });

    it('should soft-delete room type if 0 active rooms exist', async () => {
      prisma.roomType.findFirst.mockResolvedValue(mockRoomType);
      hotelAuthService.assertAdminOrManagerAccess.mockResolvedValue(undefined);
      prisma.room.count.mockResolvedValue(0);
      prisma.roomType.update.mockResolvedValue({ ...mockRoomType, isActive: false, deletedAt: new Date() });

      const result = await service.deleteRoomType('rt-100', mockAdmin);
      expect(result.success).toBe(true);
      expect(prisma.roomType.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isActive: false }),
        }),
      );
    });
  });
});
