import { Injectable, HttpStatus, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { HotelAuthorizationService } from './authorization/hotel-authorization.service';
import { CreateHotelDto } from './dto/create-hotel.dto';
import { UpdateHotelDto } from './dto/update-hotel.dto';
import { QueryHotelsDto } from './dto/query-hotels.dto';
import { AssignManagerDto } from './dto/assign-manager.dto';
import { PaginatedResult } from './types/paginated-hotels.type';
import { DomainException } from '../../common/exceptions/domain.exception';
import { UserRole, UserStatus } from '../auth/types/user-role.enum';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { RedisKeys } from '../../infrastructure/redis/redis-keys';
import { REDIS_TTL } from '../../infrastructure/redis/redis.constants';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseTimeToDate(timeStr?: string): Date | undefined {
  if (!timeStr) return undefined;
  const parts = timeStr.split(':');
  const d = new Date(1970, 0, 1, parseInt(parts[0], 10), parseInt(parts[1], 10), parts[2] ? parseInt(parts[2], 10) : 0);
  return d;
}

@Injectable()
export class HotelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hotelAuthorizationService: HotelAuthorizationService,
    @Optional() private readonly redisService?: RedisService,
  ) {}

  // ---------------------------------------------------------------------------
  // Admin Hotel Operations (Role: ADMIN)
  // ---------------------------------------------------------------------------

  /**
   * Creates a new hotel property.
   * Only administrators can create hotels.
   */
  async createHotel(dto: CreateHotelDto) {
    const slug = dto.slug ? slugify(dto.slug) : slugify(dto.name);

    // Verify slug uniqueness among non-deleted hotels
    const existing = await this.prisma.hotel.findFirst({
      where: {
        slug,
        deletedAt: null,
      },
    });

    if (existing) {
      throw new DomainException(
        'CONFLICT',
        `A hotel property with the slug '${slug}' already exists.`,
        HttpStatus.CONFLICT,
      );
    }

    // Verify initial manager if requested
    if (dto.initialManagerId) {
      const manager = await this.prisma.user.findFirst({
        where: {
          id: dto.initialManagerId,
          deletedAt: null,
        },
      });

      if (!manager || (manager.role !== UserRole.HOTEL_MANAGER && manager.role !== 'MANAGER')) {
        throw new DomainException(
          'BAD_REQUEST',
          'Specified initial manager does not exist or does not possess the HOTEL_MANAGER role.',
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const checkInDate = parseTimeToDate(dto.checkInTime);
    const checkOutDate = parseTimeToDate(dto.checkOutTime);

    const hotel = await this.prisma.hotel.create({
      data: {
        name: dto.name.trim(),
        slug,
        description: dto.description.trim(),
        starRating: dto.starRating ?? 3,
        addressLine1: dto.addressLine1.trim(),
        addressLine2: dto.addressLine2?.trim() || null,
        city: dto.city.trim(),
        state: dto.state.trim(),
        country: dto.country.trim(),
        postalCode: dto.postalCode.trim(),
        latitude: dto.latitude ? new Prisma.Decimal(dto.latitude) : null,
        longitude: dto.longitude ? new Prisma.Decimal(dto.longitude) : null,
        phone: dto.phone.trim(),
        email: dto.email.toLowerCase().trim(),
        ...(checkInDate && { checkInTime: checkInDate }),
        ...(checkOutDate && { checkOutTime: checkOutDate }),
        isActive: dto.isActive ?? true,
        ...(dto.initialManagerId && {
          managers: {
            create: {
              userId: dto.initialManagerId,
              isPrimary: true,
            },
          },
        }),
      },
      include: {
        managers: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    return hotel;
  }

  /**
   * System-wide overview of all hotels for platform administrators with database pagination.
   */
  async getAllHotelsForAdmin(query: QueryHotelsDto = {}) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.HotelWhereInput = {
      ...(query.city && { city: { contains: query.city, mode: 'insensitive' } }),
      ...(query.state && { state: { contains: query.state, mode: 'insensitive' } }),
      ...(query.country && { country: { contains: query.country, mode: 'insensitive' } }),
      ...(query.search && { name: { contains: query.search, mode: 'insensitive' } }),
      ...(query.starRating && { starRating: query.starRating }),
      ...(query.minRating && { starRating: { gte: query.minRating } }),
    };

    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder || 'desc';

    const [items, total] = await Promise.all([
      this.prisma.hotel.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          managers: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          _count: {
            select: {
              roomTypes: true,
              rooms: true,
              bookings: true,
            },
          },
        },
      }),
      this.prisma.hotel.count({ where }),
    ]);

    // Backward-compatibility: if called without query parameters, return array
    if (query.page === undefined && query.limit === undefined && !query.city && !query.search) {
      return items;
    }

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
   * Fetches any hotel by ID for administrative oversight.
   */
  async getHotelForAdmin(hotelId: string) {
    const hotel = await this.prisma.hotel.findUnique({
      where: { id: hotelId },
      include: {
        managers: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
              },
            },
          },
        },
        roomTypes: {
          include: {
            rooms: true,
          },
        },
        _count: {
          select: {
            bookings: true,
            reviews: true,
          },
        },
      },
    });

    if (!hotel) {
      throw new DomainException(
        'NOT_FOUND',
        'Hotel property not found.',
        HttpStatus.NOT_FOUND,
      );
    }

    return hotel;
  }

  /**
   * Assigns a manager to a hotel property.
   */
  async assignManagerToHotel(hotelId: string, dto: AssignManagerDto) {
    const hotel = await this.prisma.hotel.findFirst({
      where: { id: hotelId, deletedAt: null },
    });

    if (!hotel) {
      throw new DomainException(
        'NOT_FOUND',
        'Hotel property not found.',
        HttpStatus.NOT_FOUND,
      );
    }

    const manager = await this.prisma.user.findFirst({
      where: { id: dto.managerId, deletedAt: null },
    });

    if (!manager || (manager.role !== UserRole.HOTEL_MANAGER && manager.role !== 'MANAGER')) {
      throw new DomainException(
        'BAD_REQUEST',
        'User does not exist or does not possess the HOTEL_MANAGER role.',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (manager.status !== UserStatus.ACTIVE) {
      throw new DomainException(
        'BAD_REQUEST',
        `Cannot assign manager with status ${manager.status}.`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const assignment = await this.prisma.hotelManager.upsert({
      where: {
        userId_hotelId: {
          userId: dto.managerId,
          hotelId,
        },
      },
      update: {
        isPrimary: dto.isPrimary ?? false,
      },
      create: {
        userId: dto.managerId,
        hotelId,
        isPrimary: dto.isPrimary ?? false,
      },
    });

    return assignment;
  }

  /**
   * Removes a manager's assignment from a hotel property.
   */
  async unassignManagerFromHotel(hotelId: string, managerId: string) {
    const assignment = await this.prisma.hotelManager.findUnique({
      where: {
        userId_hotelId: {
          userId: managerId,
          hotelId,
        },
      },
    });

    if (!assignment) {
      throw new DomainException(
        'NOT_FOUND',
        'Manager assignment not found for this hotel property.',
        HttpStatus.NOT_FOUND,
      );
    }

    await this.prisma.hotelManager.delete({
      where: {
        userId_hotelId: {
          userId: managerId,
          hotelId,
        },
      },
    });

    return { message: 'Manager assignment successfully revoked.' };
  }

  // ---------------------------------------------------------------------------
  // Manager Portal Operations (Role: HOTEL_MANAGER + Assignment Invariant)
  // ---------------------------------------------------------------------------

  /**
   * Retrieves all hotels assigned to the authenticated manager with database-level pagination.
   */
  async getManagedHotels(managerId: string, query: QueryHotelsDto = {}) {
    const managedIds =
      await this.hotelAuthorizationService.getManagedHotelIds(managerId);

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.HotelWhereInput = {
      id: { in: managedIds },
      deletedAt: null,
      ...(query.city && { city: { contains: query.city, mode: 'insensitive' } }),
      ...(query.search && { name: { contains: query.search, mode: 'insensitive' } }),
    };

    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder || 'desc';

    const [items, total] = await Promise.all([
      this.prisma.hotel.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          _count: {
            select: {
              roomTypes: true,
              rooms: true,
            },
          },
        },
      }),
      this.prisma.hotel.count({ where }),
    ]);

    // Backward-compatibility: if called without pagination parameters, return array
    if (query.page === undefined && query.limit === undefined && !query.city && !query.search) {
      return items;
    }

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
   * Retrieves a single hotel for an assigned manager.
   * Strictly verifies manager assignment to prevent horizontal IDOR.
   */
  async getHotelForManager(managerId: string, hotelId: string) {
    await this.hotelAuthorizationService.assertManagerAccess(managerId, hotelId);

    const hotel = await this.prisma.hotel.findUnique({
      where: { id: hotelId },
      include: {
        roomTypes: {
          where: { deletedAt: null },
          include: { rooms: { where: { deletedAt: null } } },
        },
      },
    });

    if (!hotel || hotel.deletedAt !== null) {
      throw new DomainException(
        'NOT_FOUND',
        'Hotel property not found.',
        HttpStatus.NOT_FOUND,
      );
    }

    return hotel;
  }

  /**
   * Updates an assigned hotel property.
   * Strictly verifies manager assignment before executing mutation.
   */
  async updateHotelForManager(
    managerId: string,
    hotelId: string,
    dto: UpdateHotelDto,
  ) {
    await this.hotelAuthorizationService.assertManagerAccess(managerId, hotelId);

    const checkInDate = parseTimeToDate(dto.checkInTime);
    const checkOutDate = parseTimeToDate(dto.checkOutTime);

    const updated = await this.prisma.hotel.update({
      where: { id: hotelId },
      data: {
        ...(dto.name && { name: dto.name.trim() }),
        ...(dto.description && { description: dto.description.trim() }),
        ...(dto.phone && { phone: dto.phone.trim() }),
        ...(dto.email && { email: dto.email.toLowerCase().trim() }),
        ...(dto.starRating && { starRating: dto.starRating }),
        ...(dto.addressLine1 && { addressLine1: dto.addressLine1.trim() }),
        ...(dto.addressLine2 !== undefined && { addressLine2: dto.addressLine2 ? dto.addressLine2.trim() : null }),
        ...(dto.city && { city: dto.city.trim() }),
        ...(dto.state && { state: dto.state.trim() }),
        ...(dto.country && { country: dto.country.trim() }),
        ...(dto.postalCode && { postalCode: dto.postalCode.trim() }),
        ...(dto.latitude !== undefined && { latitude: dto.latitude ? new Prisma.Decimal(dto.latitude) : null }),
        ...(dto.longitude !== undefined && { longitude: dto.longitude ? new Prisma.Decimal(dto.longitude) : null }),
        ...(checkInDate && { checkInTime: checkInDate }),
        ...(checkOutDate && { checkOutTime: checkOutDate }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    if (this.redisService) {
      await this.redisService.delete(RedisKeys.hotel(hotelId));
    }

    return updated;
  }

  /**
   * Soft-deletes a hotel property.
   * Strictly verifies manager assignment.
   */
  async deleteHotelForManager(managerId: string, hotelId: string) {
    await this.hotelAuthorizationService.assertManagerAccess(managerId, hotelId);

    await this.prisma.hotel.update({
      where: { id: hotelId },
      data: { deletedAt: new Date(), isActive: false },
    });

    if (this.redisService) {
      await this.redisService.delete(RedisKeys.hotel(hotelId));
    }

    return { message: 'Hotel property successfully deactivated.' };
  }

  // ---------------------------------------------------------------------------
  // Public / Customer Discovery Operations
  // ---------------------------------------------------------------------------

  /**
   * Public / Customer discovery listing of active hotels with database pagination and filters.
   */
  async findPublicHotels(query: QueryHotelsDto = {}): Promise<PaginatedResult<any>> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.HotelWhereInput = {
      isActive: true,
      deletedAt: null,
      ...(query.city && { city: { contains: query.city, mode: 'insensitive' } }),
      ...(query.state && { state: { contains: query.state, mode: 'insensitive' } }),
      ...(query.country && { country: { contains: query.country, mode: 'insensitive' } }),
      ...(query.search && { name: { contains: query.search, mode: 'insensitive' } }),
      ...(query.starRating && { starRating: query.starRating }),
      ...(query.minRating && { starRating: { gte: query.minRating } }),
    };

    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder || 'desc';

    const [items, total] = await Promise.all([
      this.prisma.hotel.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          starRating: true,
          addressLine1: true,
          city: true,
          state: true,
          country: true,
          postalCode: true,
          latitude: true,
          longitude: true,
          checkInTime: true,
          checkOutTime: true,
          _count: {
            select: {
              roomTypes: true,
            },
          },
        },
      }),
      this.prisma.hotel.count({ where }),
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
   * Public discovery endpoint for retrieving an active hotel by ID.
   */
  async findPublicHotelById(hotelId: string) {
    const cacheKey = RedisKeys.hotel(hotelId);

    const loader = async () => {
      const hotel = await this.prisma.hotel.findFirst({
        where: {
          id: hotelId,
          isActive: true,
          deletedAt: null,
        },
        include: {
          roomTypes: {
            where: { isActive: true, deletedAt: null },
            select: {
              id: true,
              name: true,
              slug: true,
              description: true,
              maxOccupancy: true,
              basePriceCents: true,
              currency: true,
              bedType: true,
            },
          },
        },
      });

      if (!hotel) {
        throw new DomainException(
          'NOT_FOUND',
          'Hotel property not found or is currently unavailable.',
          HttpStatus.NOT_FOUND,
        );
      }

      return hotel;
    };

    if (this.redisService) {
      return this.redisService.wrap(cacheKey, loader, REDIS_TTL.MEDIUM);
    }

    return loader();
  }

  /**
   * Backward-compatible customer endpoint for listing active hotels.
   */
  async getHotelsForCustomer() {
    return this.prisma.hotel.findMany({
      where: {
        isActive: true,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        starRating: true,
        city: true,
        state: true,
        country: true,
      },
    });
  }
}
