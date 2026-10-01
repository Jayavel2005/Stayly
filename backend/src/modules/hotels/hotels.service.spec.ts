import { HttpStatus } from '@nestjs/common';
import { HotelsService } from './hotels.service';
import { HotelAuthorizationService } from './authorization/hotel-authorization.service';
import { PrismaService } from '../../prisma/prisma.service';
import { DomainException } from '../../common/exceptions/domain.exception';
import { UserRole, UserStatus } from '../auth/types/user-role.enum';

describe('HotelsService Unit Tests', () => {
  let service: HotelsService;
  let prisma: any;
  let authzService: any;

  const mockHotel = {
    id: 'hotel-123',
    name: 'Stayora Grand Palace',
    slug: 'stayora-grand-palace',
    description: 'A magnificent luxury heritage hotel in Mumbai.',
    starRating: 5,
    addressLine1: 'Apollo Bunder',
    addressLine2: null,
    city: 'Mumbai',
    state: 'Maharashtra',
    country: 'India',
    postalCode: '400001',
    latitude: null,
    longitude: null,
    phone: '+912266653300',
    email: 'grand@stayora.com',
    checkInTime: new Date(1970, 0, 1, 14, 0, 0),
    checkOutTime: new Date(1970, 0, 1, 11, 0, 0),
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(() => {
    prisma = {
      hotel: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      user: {
        findFirst: jest.fn(),
      },
      hotelManager: {
        upsert: jest.fn(),
        delete: jest.fn(),
        findUnique: jest.fn(),
      },
    };

    authzService = {
      assertManagerAccess: jest.fn(),
      getManagedHotelIds: jest.fn(),
    };

    service = new HotelsService(
      prisma as PrismaService,
      authzService as HotelAuthorizationService,
    );
  });

  describe('createHotel', () => {
    it('should create a hotel property and generate slug when omitted', async () => {
      prisma.hotel.findFirst.mockResolvedValue(null);
      prisma.hotel.create.mockResolvedValue(mockHotel);

      const result = await service.createHotel({
        name: 'Stayora Grand Palace',
        description: 'A magnificent luxury heritage hotel in Mumbai.',
        starRating: 5,
        addressLine1: 'Apollo Bunder',
        city: 'Mumbai',
        state: 'Maharashtra',
        country: 'India',
        postalCode: '400001',
        phone: '+912266653300',
        email: 'grand@stayora.com',
      });

      expect(prisma.hotel.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Stayora Grand Palace',
          slug: 'stayora-grand-palace',
          city: 'Mumbai',
          isActive: true,
        }),
        include: expect.any(Object),
      });

      expect(result.id).toBe(mockHotel.id);
    });

    it('should throw 409 CONFLICT if a hotel with the same slug already exists', async () => {
      prisma.hotel.findFirst.mockResolvedValue(mockHotel);

      await expect(
        service.createHotel({
          name: 'Stayora Grand Palace',
          description: 'Duplicate hotel test.',
          addressLine1: 'Apollo Bunder',
          city: 'Mumbai',
          state: 'Maharashtra',
          country: 'India',
          postalCode: '400001',
          phone: '+912266653300',
          email: 'grand@stayora.com',
        }),
      ).rejects.toThrow(DomainException);

      try {
        await service.createHotel({
          name: 'Stayora Grand Palace',
          description: 'Duplicate hotel test.',
          addressLine1: 'Apollo Bunder',
          city: 'Mumbai',
          state: 'Maharashtra',
          country: 'India',
          postalCode: '400001',
          phone: '+912266653300',
          email: 'grand@stayora.com',
        });
      } catch (err: any) {
        expect(err.getStatus()).toBe(HttpStatus.CONFLICT);
        expect(err.code).toBe('CONFLICT');
      }
    });

    it('should throw 400 BAD_REQUEST if initialManagerId is not a valid HOTEL_MANAGER', async () => {
      prisma.hotel.findFirst.mockResolvedValue(null);
      prisma.user.findFirst.mockResolvedValue({
        id: 'cust-1',
        role: UserRole.CUSTOMER,
      });

      await expect(
        service.createHotel({
          name: 'Stayora Boutique',
          description: 'Boutique hotel with bad manager test.',
          addressLine1: 'Road 1',
          city: 'Goa',
          state: 'Goa',
          country: 'India',
          postalCode: '403001',
          phone: '+918322470000',
          email: 'boutique@stayora.com',
          initialManagerId: 'cust-1',
        }),
      ).rejects.toThrow(DomainException);
    });
  });

  describe('findPublicHotels (Pagination & Filters)', () => {
    it('should query active hotels with database pagination', async () => {
      prisma.hotel.findMany.mockResolvedValue([mockHotel]);
      prisma.hotel.count.mockResolvedValue(1);

      const result = await service.findPublicHotels({
        page: 1,
        limit: 10,
        city: 'Mumbai',
      });

      expect(prisma.hotel.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          isActive: true,
          deletedAt: null,
          city: { contains: 'Mumbai', mode: 'insensitive' },
        }),
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: expect.any(Object),
      });

      expect(result.items.length).toBe(1);
      expect(result.meta).toEqual({
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      });
    });
  });

  describe('findPublicHotelById', () => {
    it('should return active hotel by ID', async () => {
      prisma.hotel.findFirst.mockResolvedValue(mockHotel);

      const result = await service.findPublicHotelById(mockHotel.id);
      expect(result.id).toBe(mockHotel.id);
    });

    it('should throw 404 NOT_FOUND if hotel is not found or inactive', async () => {
      prisma.hotel.findFirst.mockResolvedValue(null);

      await expect(
        service.findPublicHotelById('nonexistent-id'),
      ).rejects.toThrow(DomainException);
    });
  });

  describe('Manager Operations with Authorization Enforcement', () => {
    it('should get hotel for manager after asserting assignment', async () => {
      authzService.assertManagerAccess.mockResolvedValue(undefined);
      prisma.hotel.findUnique.mockResolvedValue(mockHotel);

      const result = await service.getHotelForManager('mgr-1', mockHotel.id);

      expect(authzService.assertManagerAccess).toHaveBeenCalledWith('mgr-1', mockHotel.id);
      expect(result.id).toBe(mockHotel.id);
    });

    it('should update hotel for manager after asserting assignment', async () => {
      authzService.assertManagerAccess.mockResolvedValue(undefined);
      prisma.hotel.update.mockResolvedValue({
        ...mockHotel,
        phone: '+912266659999',
      });

      const updated = await service.updateHotelForManager('mgr-1', mockHotel.id, {
        phone: '+912266659999',
      });

      expect(authzService.assertManagerAccess).toHaveBeenCalledWith('mgr-1', mockHotel.id);
      expect(updated.phone).toBe('+912266659999');
    });

    it('should soft-delete hotel for manager setting deletedAt and isActive:false', async () => {
      authzService.assertManagerAccess.mockResolvedValue(undefined);
      prisma.hotel.update.mockResolvedValue({
        ...mockHotel,
        isActive: false,
        deletedAt: new Date(),
      });

      const res = await service.deleteHotelForManager('mgr-1', mockHotel.id);

      expect(authzService.assertManagerAccess).toHaveBeenCalledWith('mgr-1', mockHotel.id);
      expect(prisma.hotel.update).toHaveBeenCalledWith({
        where: { id: mockHotel.id },
        data: expect.objectContaining({
          isActive: false,
          deletedAt: expect.any(Date),
        }),
      });
      expect(res.message).toContain('successfully deactivated');
    });
  });

  describe('Manager Assignment Management', () => {
    it('should assign a valid active manager to hotel', async () => {
      prisma.hotel.findFirst.mockResolvedValue(mockHotel);
      prisma.user.findFirst.mockResolvedValue({
        id: 'mgr-1',
        role: UserRole.HOTEL_MANAGER,
        status: UserStatus.ACTIVE,
      });
      prisma.hotelManager.upsert.mockResolvedValue({
        userId: 'mgr-1',
        hotelId: mockHotel.id,
        isPrimary: true,
      });

      const assignment = await service.assignManagerToHotel(mockHotel.id, {
        managerId: 'mgr-1',
        isPrimary: true,
      });

      expect(assignment.userId).toBe('mgr-1');
      expect(assignment.hotelId).toBe(mockHotel.id);
    });

    it('should revoke a manager assignment', async () => {
      prisma.hotelManager.findUnique.mockResolvedValue({
        userId: 'mgr-1',
        hotelId: mockHotel.id,
      });
      prisma.hotelManager.delete.mockResolvedValue({});

      const res = await service.unassignManagerFromHotel(mockHotel.id, 'mgr-1');
      expect(res.message).toContain('successfully revoked');
    });
  });
});
