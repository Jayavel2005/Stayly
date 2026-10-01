import { Injectable, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { HotelAuthorizationService } from '../hotels/authorization/hotel-authorization.service';
import { DomainException } from '../../common/exceptions/domain.exception';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { QueryRoomsDto } from './dto/query-rooms.dto';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { UserRole } from '../auth/types/user-role.enum';
import { RoomOperationalStatus } from './types/room-operational-status.enum';
import { PaginatedRooms } from './types/paginated-rooms.type';
import { Prisma } from '@prisma/client';

@Injectable()
export class RoomsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hotelAuthService: HotelAuthorizationService,
  ) {}

  /**
   * Create a physical room inventory unit.
   * The hotel relationship is strictly derived from the validated RoomType.
   */
  async createRoom(
    user: AuthenticatedUser,
    dto: CreateRoomDto,
  ) {
    // 1. Fetch RoomType and derive hotelId
    const roomType = await this.prisma.roomType.findFirst({
      where: {
        id: dto.roomTypeId,
        deletedAt: null,
      },
      select: {
        id: true,
        hotelId: true,
        isActive: true,
      },
    });

    if (!roomType) {
      throw new DomainException(
        'ROOM_TYPE_NOT_FOUND',
        'Room type not found.',
        HttpStatus.NOT_FOUND,
      );
    }

    const hotelId = roomType.hotelId;

    // 2. Validate client-supplied hotelId if present (prevent cross-hotel mismatch)
    if (dto.hotelId && dto.hotelId !== hotelId) {
      throw new DomainException(
        'ROOM_TYPE_HOTEL_MISMATCH',
        'Specified hotelId does not match the parent hotel of the room category.',
        HttpStatus.BAD_REQUEST,
      );
    }

    // 3. Authorization: Only ADMIN or assigned HOTEL_MANAGER can create rooms
    await this.hotelAuthService.assertAdminOrManagerAccess(user, hotelId);

    const roomNumber = dto.roomNumber.trim();

    // 4. Verify room number uniqueness within the specific hotel property
    const existing = await this.prisma.room.findFirst({
      where: {
        hotelId,
        roomNumber,
        deletedAt: null,
      },
    });

    if (existing) {
      throw new DomainException(
        'ROOM_NUMBER_ALREADY_EXISTS',
        `Room number "${roomNumber}" already exists in this hotel property.`,
        HttpStatus.CONFLICT,
      );
    }

    // 5. Create physical room record
    try {
      const room = await this.prisma.room.create({
        data: {
          hotelId,
          roomTypeId: roomType.id,
          roomNumber,
          floor: dto.floor ?? 1,
          operationalStatus:
            dto.operationalStatus ?? RoomOperationalStatus.AVAILABLE,
        },
        include: {
          roomType: {
            select: {
              id: true,
              name: true,
              slug: true,
              bedType: true,
            },
          },
          hotel: {
            select: {
              id: true,
              name: true,
              city: true,
            },
          },
        },
      });

      return room;
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new DomainException(
          'ROOM_NUMBER_ALREADY_EXISTS',
          `Room number "${roomNumber}" already exists in this hotel property.`,
          HttpStatus.CONFLICT,
        );
      }
      throw error;
    }
  }

  /**
   * List rooms with database-level pagination, sorting, and manager assignment scoping.
   */
  async findRooms(
    query: QueryRoomsDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedRooms<any>> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.RoomWhereInput = {
      deletedAt: null,
    };

    // Scoping by user role
    if (
      user.role === UserRole.HOTEL_MANAGER ||
      user.role === 'MANAGER'
    ) {
      if (query.hotelId) {
        await this.hotelAuthService.assertManagerAccess(user.id, query.hotelId);
        where.hotelId = query.hotelId;
      } else if (query.roomTypeId) {
        const roomType = await this.prisma.roomType.findFirst({
          where: { id: query.roomTypeId, deletedAt: null },
          select: { hotelId: true },
        });
        if (!roomType) {
          throw new DomainException(
            'ROOM_TYPE_NOT_FOUND',
            'Room type not found.',
            HttpStatus.NOT_FOUND,
          );
        }
        await this.hotelAuthService.assertManagerAccess(
          user.id,
          roomType.hotelId,
        );
        where.roomTypeId = query.roomTypeId;
      } else {
        const managedHotelIds = await this.hotelAuthService.getManagedHotelIds(
          user.id,
        );
        where.hotelId = { in: managedHotelIds };
      }
    } else if (user.role === UserRole.ADMIN) {
      if (query.hotelId) {
        where.hotelId = query.hotelId;
      }
      if (query.roomTypeId) {
        where.roomTypeId = query.roomTypeId;
      }
    }

    if (query.operationalStatus) {
      where.operationalStatus = query.operationalStatus;
    }

    if (query.floor !== undefined) {
      where.floor = query.floor;
    }

    if (query.search?.trim()) {
      where.roomNumber = {
        contains: query.search.trim(),
        mode: 'insensitive',
      };
    }

    const orderBy: Prisma.RoomOrderByWithRelationInput = {
      [query.sortBy || 'roomNumber']: query.sortOrder || 'asc',
    };

    const [total, items] = await Promise.all([
      this.prisma.room.count({ where }),
      this.prisma.room.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          roomType: {
            select: {
              id: true,
              name: true,
              slug: true,
              bedType: true,
            },
          },
          hotel: {
            select: {
              id: true,
              name: true,
              city: true,
            },
          },
        },
      }),
    ]);

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Retrieve physical room by ID with authorization check.
   */
  async findRoomById(id: string, user: AuthenticatedUser) {
    const room = await this.prisma.room.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        roomType: {
          select: {
            id: true,
            name: true,
            slug: true,
            bedType: true,
            basePriceCents: true,
            currency: true,
          },
        },
        hotel: {
          select: {
            id: true,
            name: true,
            city: true,
            country: true,
          },
        },
      },
    });

    if (!room) {
      throw new DomainException(
        'ROOM_NOT_FOUND',
        'Physical room unit not found.',
        HttpStatus.NOT_FOUND,
      );
    }

    if (
      user.role === UserRole.HOTEL_MANAGER ||
      user.role === 'MANAGER'
    ) {
      await this.hotelAuthService.assertManagerAccess(user.id, room.hotelId);
    }

    return room;
  }

  /**
   * Update mutable room fields. Reassigning roomType is restricted to the SAME hotel.
   */
  async updateRoom(
    id: string,
    dto: UpdateRoomDto,
    user: AuthenticatedUser,
  ) {
    const room = await this.prisma.room.findFirst({
      where: { id, deletedAt: null },
    });

    if (!room) {
      throw new DomainException(
        'ROOM_NOT_FOUND',
        'Physical room unit not found.',
        HttpStatus.NOT_FOUND,
      );
    }

    await this.hotelAuthService.assertAdminOrManagerAccess(user, room.hotelId);

    const data: Prisma.RoomUpdateInput = {};

    // If reassigning room category, ensure the new category belongs to the SAME hotel
    if (dto.roomTypeId && dto.roomTypeId !== room.roomTypeId) {
      const newRoomType = await this.prisma.roomType.findFirst({
        where: { id: dto.roomTypeId, deletedAt: null },
        select: { id: true, hotelId: true },
      });

      if (!newRoomType) {
        throw new DomainException(
          'ROOM_TYPE_NOT_FOUND',
          'Target room category not found.',
          HttpStatus.NOT_FOUND,
        );
      }

      if (newRoomType.hotelId !== room.hotelId) {
        throw new DomainException(
          'ROOM_TYPE_HOTEL_MISMATCH',
          'Cannot reassign room to a room category in a different hotel property.',
          HttpStatus.BAD_REQUEST,
        );
      }

      data.roomType = { connect: { id: newRoomType.id } };
    }

    if (dto.roomNumber) {
      const cleanNumber = dto.roomNumber.trim();
      if (cleanNumber !== room.roomNumber) {
        const existing = await this.prisma.room.findFirst({
          where: {
            hotelId: room.hotelId,
            roomNumber: cleanNumber,
            deletedAt: null,
            NOT: { id: room.id },
          },
        });

        if (existing) {
          throw new DomainException(
            'ROOM_NUMBER_ALREADY_EXISTS',
            `Room number "${cleanNumber}" already exists in this hotel property.`,
            HttpStatus.CONFLICT,
          );
        }

        data.roomNumber = cleanNumber;
      }
    }

    if (dto.floor !== undefined) {
      data.floor = dto.floor;
    }

    if (dto.operationalStatus) {
      data.operationalStatus = dto.operationalStatus;
    }

    try {
      const updated = await this.prisma.room.update({
        where: { id },
        data,
        include: {
          roomType: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      });

      return updated;
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new DomainException(
          'ROOM_NUMBER_ALREADY_EXISTS',
          `Room number already exists in this hotel property.`,
          HttpStatus.CONFLICT,
        );
      }
      throw error;
    }
  }

  /**
   * Update the operational status of a physical room unit.
   */
  async updateRoomStatus(
    id: string,
    status: RoomOperationalStatus,
    user: AuthenticatedUser,
  ) {
    const room = await this.prisma.room.findFirst({
      where: { id, deletedAt: null },
    });

    if (!room) {
      throw new DomainException(
        'ROOM_NOT_FOUND',
        'Physical room unit not found.',
        HttpStatus.NOT_FOUND,
      );
    }

    await this.hotelAuthService.assertAdminOrManagerAccess(user, room.hotelId);

    const updated = await this.prisma.room.update({
      where: { id },
      data: {
        operationalStatus: status,
      },
      include: {
        roomType: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return updated;
  }

  /**
   * Soft-delete a physical room unit (sets deletedAt and OUT_OF_SERVICE).
   */
  async deleteRoom(id: string, user: AuthenticatedUser) {
    const room = await this.prisma.room.findFirst({
      where: { id, deletedAt: null },
    });

    if (!room) {
      throw new DomainException(
        'ROOM_NOT_FOUND',
        'Physical room unit not found.',
        HttpStatus.NOT_FOUND,
      );
    }

    await this.hotelAuthService.assertAdminOrManagerAccess(user, room.hotelId);

    const deleted = await this.prisma.room.update({
      where: { id },
      data: {
        operationalStatus: RoomOperationalStatus.OUT_OF_SERVICE,
        deletedAt: new Date(),
      },
    });

    return {
      success: true,
      message: 'Physical room unit soft-deleted successfully.',
      id: deleted.id,
    };
  }
}
