import { HttpStatus } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { HotelAuthorizationService } from '../hotels/authorization/hotel-authorization.service';
import { PrismaService } from '../../prisma/prisma.service';
import { DomainException } from '../../common/exceptions/domain.exception';
import { UserRole, UserStatus } from '../auth/types/user-role.enum';
import { RoomOperationalStatus } from './types/room-operational-status.enum';

describe('RoomsService Unit Tests', () => {
  let service: RoomsService;
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

  const mockRoomType = {
    id: 'rt-100',
    hotelId: 'hotel-1',
    name: 'Deluxe Suite',
    isActive: true,
  };

  const mockRoom = {
    id: 'room-1',
    hotelId: 'hotel-1',
    roomTypeId: 'rt-100',
    roomNumber: '101',
    floor: 1,
    operationalStatus: RoomOperationalStatus.AVAILABLE,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    roomType: {
      id: 'rt-100',
      name: 'Deluxe Suite',
      slug: 'deluxe-suite',
      bedType: 'KING',
    },
    hotel: {
      id: 'hotel-1',
      name: 'Stayora Mumbai',
      city: 'Mumbai',
    },
  };

  beforeEach(() => {
    prisma = {
      room: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      roomType: {
        findFirst: jest.fn(),
      },
    };

    hotelAuthService = {
      assertAdminOrManagerAccess: jest.fn(),
      assertManagerAccess: jest.fn(),
      getManagedHotelIds: jest.fn(),
    };

    service = new RoomsService(prisma as unknown as PrismaService, hotelAuthService as unknown as HotelAuthorizationService);
  });

  describe('createRoom', () => {
    const dto = {
      roomTypeId: 'rt-100',
      roomNumber: '101',
      floor: 1,
      operationalStatus: RoomOperationalStatus.AVAILABLE,
    };

    it('should allow authorized manager to create a Room derived from RoomType', async () => {
      prisma.roomType.findFirst.mockResolvedValue(mockRoomType);
      hotelAuthService.assertAdminOrManagerAccess.mockResolvedValue(undefined);
      prisma.room.findFirst.mockResolvedValue(null);
      prisma.room.create.mockResolvedValue(mockRoom);

      const result = await service.createRoom(mockManagerA, dto);

      expect(prisma.roomType.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'rt-100', deletedAt: null } }),
      );
      expect(hotelAuthService.assertAdminOrManagerAccess).toHaveBeenCalledWith(mockManagerA, 'hotel-1');
      expect(prisma.room.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            hotelId: 'hotel-1',
            roomTypeId: 'rt-100',
            roomNumber: '101',
          }),
        }),
      );
      expect(result).toEqual(mockRoom);
    });

    it('should throw 404 if RoomType does not exist', async () => {
      prisma.roomType.findFirst.mockResolvedValue(null);

      await expect(service.createRoom(mockManagerA, dto)).rejects.toThrow(DomainException);
    });

    it('should reject when supplied hotelId contradicts roomType parent hotel', async () => {
      prisma.roomType.findFirst.mockResolvedValue(mockRoomType); // hotel-1

      await expect(
        service.createRoom(mockManagerA, {
          ...dto,
          hotelId: 'hotel-2', // Mismatch!
        }),
      ).rejects.toThrow(DomainException);
    });

    it('should reject unauthorized manager with 403 Forbidden', async () => {
      prisma.roomType.findFirst.mockResolvedValue(mockRoomType);
      hotelAuthService.assertAdminOrManagerAccess.mockRejectedValue(
        new DomainException('FORBIDDEN', 'Access denied.', HttpStatus.FORBIDDEN),
      );

      await expect(service.createRoom(mockManagerA, dto)).rejects.toThrow(DomainException);
    });

    it('should reject duplicate room number in the same hotel with 409 Conflict', async () => {
      prisma.roomType.findFirst.mockResolvedValue(mockRoomType);
      hotelAuthService.assertAdminOrManagerAccess.mockResolvedValue(undefined);
      prisma.room.findFirst.mockResolvedValue(mockRoom); // already exists

      await expect(service.createRoom(mockManagerA, dto)).rejects.toThrow(DomainException);
    });
  });

  describe('findRooms', () => {
    it('should scope room listing to managed hotels when queried by manager', async () => {
      hotelAuthService.getManagedHotelIds.mockResolvedValue(['hotel-1']);
      prisma.room.count.mockResolvedValue(1);
      prisma.room.findMany.mockResolvedValue([mockRoom]);

      const result = await service.findRooms({}, mockManagerA);

      expect(prisma.room.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            hotelId: { in: ['hotel-1'] },
          }),
        }),
      );
      expect(result.items).toHaveLength(1);
    });
  });

  describe('findRoomById', () => {
    it('should retrieve room and verify manager access', async () => {
      prisma.room.findFirst.mockResolvedValue(mockRoom);
      hotelAuthService.assertManagerAccess.mockResolvedValue(undefined);

      const result = await service.findRoomById('room-1', mockManagerA);

      expect(hotelAuthService.assertManagerAccess).toHaveBeenCalledWith('manager-a', 'hotel-1');
      expect(result).toEqual(mockRoom);
    });

    it('should throw 404 if room not found', async () => {
      prisma.room.findFirst.mockResolvedValue(null);

      await expect(service.findRoomById('non-existent', mockAdmin)).rejects.toThrow(DomainException);
    });
  });

  describe('updateRoom', () => {
    it('should reject cross-hotel roomType reassignment with 400 Bad Request', async () => {
      prisma.room.findFirst.mockResolvedValue(mockRoom); // belongs to hotel-1
      hotelAuthService.assertAdminOrManagerAccess.mockResolvedValue(undefined);
      prisma.roomType.findFirst.mockResolvedValue({ id: 'rt-999', hotelId: 'hotel-2' }); // different hotel!

      await expect(
        service.updateRoom('room-1', { roomTypeId: 'rt-999' }, mockAdmin),
      ).rejects.toThrow(DomainException);
    });

    it('should reject room number collision in the same hotel', async () => {
      prisma.room.findFirst.mockResolvedValueOnce(mockRoom); // original room
      hotelAuthService.assertAdminOrManagerAccess.mockResolvedValue(undefined);
      prisma.room.findFirst.mockResolvedValueOnce({ id: 'room-2', roomNumber: '102' }); // conflict!

      await expect(
        service.updateRoom('room-1', { roomNumber: '102' }, mockAdmin),
      ).rejects.toThrow(DomainException);
    });
  });

  describe('updateRoomStatus', () => {
    it('should update operational status', async () => {
      prisma.room.findFirst.mockResolvedValue(mockRoom);
      hotelAuthService.assertAdminOrManagerAccess.mockResolvedValue(undefined);
      prisma.room.update.mockResolvedValue({
        ...mockRoom,
        operationalStatus: RoomOperationalStatus.MAINTENANCE,
      });

      const result = await service.updateRoomStatus(
        'room-1',
        RoomOperationalStatus.MAINTENANCE,
        mockManagerA,
      );

      expect(prisma.room.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { operationalStatus: RoomOperationalStatus.MAINTENANCE },
        }),
      );
      expect(result.operationalStatus).toBe(RoomOperationalStatus.MAINTENANCE);
    });
  });

  describe('deleteRoom', () => {
    it('should soft-delete room and mark OUT_OF_SERVICE', async () => {
      prisma.room.findFirst.mockResolvedValue(mockRoom);
      hotelAuthService.assertAdminOrManagerAccess.mockResolvedValue(undefined);
      prisma.room.update.mockResolvedValue({
        ...mockRoom,
        operationalStatus: RoomOperationalStatus.OUT_OF_SERVICE,
        deletedAt: new Date(),
      });

      const result = await service.deleteRoom('room-1', mockManagerA);

      expect(result.success).toBe(true);
      expect(prisma.room.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            operationalStatus: RoomOperationalStatus.OUT_OF_SERVICE,
          }),
        }),
      );
    });
  });
});
