import { Injectable, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { HotelAuthorizationService } from '../hotels/authorization/hotel-authorization.service';
import { DomainException } from '../../common/exceptions/domain.exception';
import { CreateRoomTypeDto } from './dto/create-room-type.dto';
import { UpdateRoomTypeDto } from './dto/update-room-type.dto';
import { QueryRoomTypesDto } from './dto/query-room-types.dto';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { UserRole } from '../auth/types/user-role.enum';
import { PaginatedRoomTypes } from './types/paginated-room-types.type';
import { Prisma } from '@prisma/client';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

@Injectable()
export class RoomTypesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hotelAuthService: HotelAuthorizationService,
  ) {}

  /**
   * Create a new room type within an authorized hotel property.
   */
  async createRoomType(
    user: AuthenticatedUser,
    dto: CreateRoomTypeDto,
  ) {
    // 1. Authorization: Only ADMIN or assigned HOTEL_MANAGER can create room types
    await this.hotelAuthService.assertAdminOrManagerAccess(user, dto.hotelId);

    // 2. Validate occupancy logic
    const maxOccupancy = dto.maxOccupancy ?? 2;
    const maxAdults = dto.maxAdults ?? 2;
    const maxChildren = dto.maxChildren ?? 1;

    if (maxAdults > maxOccupancy) {
      throw new DomainException(
        'INVALID_OCCUPANCY',
        'Maximum adults cannot exceed total maximum occupancy.',
        HttpStatus.BAD_REQUEST,
      );
    }

    // 3. Resolve slug and enforce uniqueness within the hotel
    const slug = dto.slug ? slugify(dto.slug) : slugify(dto.name);
    const existing = await this.prisma.roomType.findUnique({
      where: {
        hotelId_slug: {
          hotelId: dto.hotelId,
          slug,
        },
      },
    });

    if (existing && !existing.deletedAt) {
      throw new DomainException(
        'ROOM_TYPE_ALREADY_EXISTS',
        'A room type with this name or slug already exists in this hotel property.',
        HttpStatus.CONFLICT,
      );
    }

    // 4. Create room type with BigInt price and optional amenity relations
    try {
      const roomType = await this.prisma.roomType.create({
        data: {
          hotelId: dto.hotelId,
          name: dto.name,
          slug,
          description: dto.description,
          maxOccupancy,
          maxAdults,
          maxChildren,
          basePriceCents: BigInt(dto.basePriceCents),
          currency: dto.currency ?? 'INR',
          bedType: dto.bedType ?? 'KING',
          sizeSqMeters: dto.sizeSqMeters,
          isActive: dto.isActive ?? true,
          amenities: dto.amenityIds?.length
            ? {
                create: dto.amenityIds.map((amenityId) => ({
                  amenity: { connect: { id: amenityId } },
                })),
              }
            : undefined,
        },
        include: {
          hotel: {
            select: {
              id: true,
              name: true,
              city: true,
              country: true,
            },
          },
          amenities: {
            include: {
              amenity: true,
            },
          },
        },
      });

      return roomType;
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new DomainException(
          'ROOM_TYPE_ALREADY_EXISTS',
          'A room type with this slug already exists in this hotel property.',
          HttpStatus.CONFLICT,
        );
      }
      throw error;
    }
  }

  /**
   * Find room types with role-aware scoping and database-level pagination.
   */
  async findRoomTypes(
    query: QueryRoomTypesDto,
    user?: AuthenticatedUser,
  ): Promise<PaginatedRoomTypes<any>> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.RoomTypeWhereInput = {
      deletedAt: null,
    };

    // Public / Customer access
    if (!user || user.role === UserRole.CUSTOMER) {
      where.isActive = true;
      where.hotel = {
        isActive: true,
        deletedAt: null,
      };

      if (query.hotelId) {
        where.hotelId = query.hotelId;
      }
    } else if (
      user.role === UserRole.HOTEL_MANAGER ||
      user.role === 'MANAGER'
    ) {
      // Hotel Manager: scoped to assigned hotels
      if (query.hotelId) {
        await this.hotelAuthService.assertManagerAccess(user.id, query.hotelId);
        where.hotelId = query.hotelId;
      } else {
        const managedHotelIds = await this.hotelAuthService.getManagedHotelIds(
          user.id,
        );
        where.hotelId = { in: managedHotelIds };
      }

      if (query.isActive !== undefined) {
        where.isActive = query.isActive;
      }
    } else if (user.role === UserRole.ADMIN) {
      // Admin: platform oversight
      if (query.hotelId) {
        where.hotelId = query.hotelId;
      }
      if (query.isActive !== undefined) {
        where.isActive = query.isActive;
      }
    }

    // Search filter
    if (query.search?.trim()) {
      where.OR = [
        { name: { contains: query.search.trim(), mode: 'insensitive' } },
        { description: { contains: query.search.trim(), mode: 'insensitive' } },
      ];
    }

    // Sorting
    const orderBy: Prisma.RoomTypeOrderByWithRelationInput = {
      [query.sortBy || 'createdAt']: query.sortOrder || 'desc',
    };

    const [total, items] = await Promise.all([
      this.prisma.roomType.count({ where }),
      this.prisma.roomType.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          hotel: {
            select: {
              id: true,
              name: true,
              city: true,
              country: true,
            },
          },
          _count: {
            select: {
              rooms: true,
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
   * Retrieve a room type by ID with authorization checks.
   */
  async findRoomTypeById(id: string, user?: AuthenticatedUser) {
    const roomType = await this.prisma.roomType.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        hotel: {
          select: {
            id: true,
            name: true,
            city: true,
            country: true,
            isActive: true,
            deletedAt: true,
          },
        },
        amenities: {
          include: {
            amenity: true,
          },
        },
        _count: {
          select: {
            rooms: true,
          },
        },
      },
    });

    if (!roomType) {
      throw new DomainException(
        'ROOM_TYPE_NOT_FOUND',
        'Room type not found.',
        HttpStatus.NOT_FOUND,
      );
    }

    // Customer or unauthenticated visibility: Must be active and parent hotel active
    if (!user || user.role === UserRole.CUSTOMER) {
      if (
        !roomType.isActive ||
        !roomType.hotel.isActive ||
        roomType.hotel.deletedAt
      ) {
        throw new DomainException(
          'ROOM_TYPE_NOT_FOUND',
          'Room type not found or inactive.',
          HttpStatus.NOT_FOUND,
        );
      }
      return roomType;
    }

    // Manager access: must manage the parent hotel
    if (
      user.role === UserRole.HOTEL_MANAGER ||
      user.role === 'MANAGER'
    ) {
      await this.hotelAuthService.assertManagerAccess(
        user.id,
        roomType.hotelId,
      );
    }

    return roomType;
  }

  /**
   * Update a room type. Transferring between hotels is strictly forbidden.
   */
  async updateRoomType(
    id: string,
    dto: UpdateRoomTypeDto,
    user: AuthenticatedUser,
  ) {
    const existing = await this.prisma.roomType.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      throw new DomainException(
        'ROOM_TYPE_NOT_FOUND',
        'Room type not found.',
        HttpStatus.NOT_FOUND,
      );
    }

    // Assert caller is ADMIN or manager assigned to this hotel
    await this.hotelAuthService.assertAdminOrManagerAccess(
      user,
      existing.hotelId,
    );

    // If name is changed and slug not explicitly provided, update slug
    let newSlug = dto.slug ? slugify(dto.slug) : undefined;
    if (dto.name && !dto.slug && dto.name !== existing.name) {
      newSlug = slugify(dto.name);
    }

    const data: Prisma.RoomTypeUpdateInput = {};

    if (dto.name) data.name = dto.name;
    if (newSlug) data.slug = newSlug;
    if (dto.description) data.description = dto.description;
    if (dto.maxOccupancy !== undefined) data.maxOccupancy = dto.maxOccupancy;
    if (dto.maxAdults !== undefined) data.maxAdults = dto.maxAdults;
    if (dto.maxChildren !== undefined) data.maxChildren = dto.maxChildren;
    if (dto.basePriceCents !== undefined) {
      data.basePriceCents = BigInt(dto.basePriceCents);
    }
    if (dto.currency) data.currency = dto.currency;
    if (dto.bedType) data.bedType = dto.bedType;
    if (dto.sizeSqMeters !== undefined) data.sizeSqMeters = dto.sizeSqMeters;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    try {
      const updated = await this.prisma.roomType.update({
        where: { id },
        data,
        include: {
          hotel: {
            select: {
              id: true,
              name: true,
              city: true,
            },
          },
        },
      });

      return updated;
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new DomainException(
          'ROOM_TYPE_ALREADY_EXISTS',
          'A room type with this slug already exists in this hotel property.',
          HttpStatus.CONFLICT,
        );
      }
      throw error;
    }
  }

  /**
   * Delete or soft-deactivate a room type.
   * If rooms exist, deletion is prohibited to preserve physical inventory integrity.
   */
  async deleteRoomType(id: string, user: AuthenticatedUser) {
    const existing = await this.prisma.roomType.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      throw new DomainException(
        'ROOM_TYPE_NOT_FOUND',
        'Room type not found.',
        HttpStatus.NOT_FOUND,
      );
    }

    await this.hotelAuthService.assertAdminOrManagerAccess(
      user,
      existing.hotelId,
    );

    // Prevent deletion if active physical rooms exist
    const activeRoomsCount = await this.prisma.room.count({
      where: {
        roomTypeId: id,
        deletedAt: null,
      },
    });

    if (activeRoomsCount > 0) {
      throw new DomainException(
        'ROOM_TYPE_HAS_ROOMS',
        'Cannot delete a room type that still contains active rooms. Deactivate or delete associated rooms first.',
        HttpStatus.CONFLICT,
        { activeRoomsCount },
      );
    }

    // Soft delete
    const deleted = await this.prisma.roomType.update({
      where: { id },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
    });

    return {
      success: true,
      message: 'Room type soft-deleted successfully.',
      id: deleted.id,
    };
  }
}
