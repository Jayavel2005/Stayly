import { Injectable, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DomainException } from '../../common/exceptions/domain.exception';
import { SearchHotelsDto } from './dto/search-hotels.dto';
import { AvailabilityQueryDto } from './dto/availability-query.dto';
import {
  AvailableHotelResult,
  AvailableRoomTypeResult,
  PaginatedSearchResults,
  RoomTypeAvailabilitySummary,
} from './types/search-result.type';
import { SearchSortBy, SearchSortOrder } from './types/search-sort-by.enum';
import { Prisma } from '@prisma/client';

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Helper function implementing standard interval overlap logic:
   * Two half-open intervals [startA, endA) and [startB, endB) overlap if and only if:
   * startA < endB && endA > startB
   */
  isDateRangeOverlapping(
    startA: Date,
    endA: Date,
    startB: Date,
    endB: Date,
  ): boolean {
    return startA < endB && endA > startB;
  }

  /**
   * Validate and parse YYYY-MM-DD calendar date strings into UTC Date objects.
   * Enforces [checkIn, checkOut) semantics and rejects inverted or past ranges.
   */
  validateDateRange(
    checkIn: string,
    checkOut: string,
    allowPast = false,
  ): { checkInDate: Date; checkOutDate: Date; nights: number } {
    if (!checkIn || !checkOut) {
      throw new DomainException(
        'MISSING_DATE_RANGE',
        'Both checkIn and checkOut dates are required in YYYY-MM-DD format.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const inDate = new Date(checkIn + 'T00:00:00.000Z');
    const outDate = new Date(checkOut + 'T00:00:00.000Z');

    if (isNaN(inDate.getTime()) || isNaN(outDate.getTime())) {
      throw new DomainException(
        'INVALID_DATE_FORMAT',
        'Dates must be valid calendar dates formatted as YYYY-MM-DD.',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (outDate <= inDate) {
      throw new DomainException(
        'INVALID_DATE_RANGE',
        'checkOut date must be strictly after checkIn date.',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!allowPast) {
      const todayStr = new Date().toISOString().split('T')[0];
      const todayDate = new Date(todayStr + 'T00:00:00.000Z');
      if (inDate < todayDate) {
        throw new DomainException(
          'PAST_CHECK_IN_DATE',
          'checkIn date cannot be in the past for customer search.',
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const nights = Math.round(
      (outDate.getTime() - inDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    return { checkInDate: inDate, checkOutDate: outDate, nights };
  }

  /**
   * Calculate date-range availability for a specific RoomType.
   * Identifies physical operational rooms and subtracts active blocking allocations.
   * This method is designed for reuse by the Phase 8 Booking Engine.
   */
  async getRoomTypeAvailability(
    roomTypeId: string,
    checkInDate: Date,
    checkOutDate: Date,
  ): Promise<RoomTypeAvailabilitySummary> {
    const roomType = await this.prisma.roomType.findFirst({
      where: {
        id: roomTypeId,
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
        'Room category not found.',
        HttpStatus.NOT_FOUND,
      );
    }

    // 1. Fetch physical rooms with status = AVAILABLE
    const operationalRooms = await this.prisma.room.findMany({
      where: {
        roomTypeId,
        deletedAt: null,
        operationalStatus: 'AVAILABLE',
      },
      select: {
        id: true,
      },
    });

    const operationalRoomIds = operationalRooms.map((r) => r.id);

    if (operationalRoomIds.length === 0) {
      return {
        roomTypeId,
        hotelId: roomType.hotelId,
        checkIn: checkInDate.toISOString().split('T')[0],
        checkOut: checkOutDate.toISOString().split('T')[0],
        totalNights: Math.round(
          (checkOutDate.getTime() - checkInDate.getTime()) / 86400000,
        ),
        totalOperationalRooms: 0,
        occupiedRooms: 0,
        availableRooms: 0,
        hasAvailability: false,
        availableRoomIds: [],
      };
    }

    // 2. Query conflicting allocations overlapping [checkIn, checkOut)
    // Formula: existing.checkIn < requested.checkOut AND existing.checkOut > requested.checkIn
    const conflictingAllocations = await this.prisma.bookingRoom.findMany({
      where: {
        roomId: { in: operationalRoomIds },
        status: { in: ['RESERVED', 'OCCUPIED'] },
        checkInDate: { lt: checkOutDate },
        checkOutDate: { gt: checkInDate },
        booking: {
          status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] },
          OR: [
            { holdExpiresAt: null },
            { holdExpiresAt: { gt: new Date() } },
          ],
        },
      },
      select: {
        roomId: true,
      },
    });

    const conflictingRoomIds = new Set(
      conflictingAllocations.map((a) => a.roomId),
    );

    const availableRoomIds = operationalRoomIds.filter(
      (id) => !conflictingRoomIds.has(id),
    );

    return {
      roomTypeId,
      hotelId: roomType.hotelId,
      checkIn: checkInDate.toISOString().split('T')[0],
      checkOut: checkOutDate.toISOString().split('T')[0],
      totalNights: Math.round(
        (checkOutDate.getTime() - checkInDate.getTime()) / 86400000,
      ),
      totalOperationalRooms: operationalRoomIds.length,
      occupiedRooms: conflictingRoomIds.size,
      availableRooms: availableRoomIds.length,
      hasAvailability: availableRoomIds.length > 0,
      availableRoomIds,
    };
  }

  /**
   * Get availability for all room categories within a specific hotel property.
   */
  async getHotelAvailability(
    hotelId: string,
    query: AvailabilityQueryDto,
  ): Promise<AvailableHotelResult> {
    const { checkInDate, checkOutDate, nights } = this.validateDateRange(
      query.checkIn,
      query.checkOut,
    );

    const guests = query.guests || 1;
    const roomsRequested = query.rooms || 1;

    const hotel = await this.prisma.hotel.findFirst({
      where: {
        id: hotelId,
        isActive: true,
        deletedAt: null,
      },
      include: {
        roomTypes: {
          where: {
            isActive: true,
            deletedAt: null,
            maxOccupancy: { gte: guests },
          },
          include: {
            amenities: {
              include: {
                amenity: {
                  select: {
                    id: true,
                    name: true,
                    iconKey: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!hotel) {
      throw new DomainException(
        'HOTEL_NOT_FOUND',
        'Hotel property not found or is currently inactive.',
        HttpStatus.NOT_FOUND,
      );
    }

    const availableRoomTypes: AvailableRoomTypeResult[] = [];
    let totalHotelAvailableRooms = 0;

    for (const rt of hotel.roomTypes) {
      const summary = await this.getRoomTypeAvailability(
        rt.id,
        checkInDate,
        checkOutDate,
      );

      if (summary.availableRooms >= roomsRequested) {
        availableRoomTypes.push({
          id: rt.id,
          roomTypeId: rt.id,
          name: rt.name,
          slug: rt.slug,
          description: rt.description,
          maxOccupancy: rt.maxOccupancy,
          maxAdults: rt.maxAdults,
          maxChildren: rt.maxChildren,
          basePriceCents: rt.basePriceCents.toString(),
          currency: rt.currency,
          bedType: rt.bedType,
          sizeSqMeters: rt.sizeSqMeters ? Number(rt.sizeSqMeters) : null,
          availableRooms: summary.availableRooms,
          totalRooms: summary.totalOperationalRooms,
          totalOperationalRooms: summary.totalOperationalRooms,
          amenities: rt.amenities.map((a) => a.amenity),
        });
        totalHotelAvailableRooms += summary.availableRooms;
      }
    }

    const minPrice =
      availableRoomTypes.length > 0
        ? availableRoomTypes.reduce((min, rt) => {
            const p = BigInt(rt.basePriceCents);
            return p < min ? p : min;
          }, BigInt(availableRoomTypes[0].basePriceCents))
        : BigInt(0);

    return {
      id: hotel.id,
      hotelId: hotel.id,
      name: hotel.name,
      hotelName: hotel.name,
      slug: hotel.slug,
      description: hotel.description,
      starRating: hotel.starRating,
      addressLine1: hotel.addressLine1,
      addressLine2: hotel.addressLine2,
      city: hotel.city,
      state: hotel.state,
      country: hotel.country,
      postalCode: hotel.postalCode,
      latitude: hotel.latitude ? Number(hotel.latitude) : null,
      longitude: hotel.longitude ? Number(hotel.longitude) : null,
      phone: hotel.phone,
      email: hotel.email,
      checkInTime: hotel.checkInTime,
      checkOutTime: hotel.checkOutTime,
      minPriceCents: minPrice.toString(),
      totalAvailableRooms: totalHotelAvailableRooms,
      roomTypes: availableRoomTypes,
    };
  }

  /**
   * Search available hotels with database-level filtering, pagination, and date availability.
   */
  async searchAvailableHotels(
    dto: SearchHotelsDto,
  ): Promise<PaginatedSearchResults<AvailableHotelResult>> {
    const { checkInDate, checkOutDate, nights } = this.validateDateRange(
      dto.checkIn,
      dto.checkOut,
    );

    const guests = dto.guests || 1;
    const roomsRequested = dto.rooms || 1;
    const page = Math.max(1, dto.page || 1);
    const limit = Math.min(100, Math.max(1, dto.limit || 20));
    const skip = (page - 1) * limit;

    // 1. Construct database where filter
    const where: Prisma.HotelWhereInput = {
      isActive: true,
      deletedAt: null,
    };

    if (dto.city?.trim()) {
      where.city = { contains: dto.city.trim(), mode: 'insensitive' };
    }

    if (dto.state?.trim()) {
      where.state = { contains: dto.state.trim(), mode: 'insensitive' };
    }

    if (dto.country?.trim()) {
      where.country = { contains: dto.country.trim(), mode: 'insensitive' };
    }

    if (dto.hotelId) {
      where.id = dto.hotelId;
    }

    if (dto.starRating) {
      where.starRating = dto.starRating;
    }

    if (dto.minRating) {
      where.starRating = { gte: dto.minRating };
    }

    if (dto.search?.trim()) {
      where.OR = [
        { name: { contains: dto.search.trim(), mode: 'insensitive' } },
        { description: { contains: dto.search.trim(), mode: 'insensitive' } },
      ];
    }

    // Must have at least one active room type meeting occupancy and having available physical rooms
    where.roomTypes = {
      some: {
        isActive: true,
        deletedAt: null,
        maxOccupancy: { gte: guests },
        ...(dto.roomTypeId ? { id: dto.roomTypeId } : {}),
        rooms: {
          some: {
            deletedAt: null,
            operationalStatus: 'AVAILABLE',
            bookingRooms: {
              none: {
                status: { in: ['RESERVED', 'OCCUPIED'] },
                checkInDate: { lt: checkOutDate },
                checkOutDate: { gt: checkInDate },
                booking: {
                  status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] },
                  OR: [
                    { holdExpiresAt: null },
                    { holdExpiresAt: { gt: new Date() } },
                  ],
                },
              },
            },
          },
        },
      },
    };

    // Sorting
    let orderBy: Prisma.HotelOrderByWithRelationInput = {
      createdAt: dto.sortOrder || 'desc',
    };

    if (dto.sortBy === SearchSortBy.NAME) {
      orderBy = { name: dto.sortOrder || 'asc' };
    } else if (dto.sortBy === SearchSortBy.STAR_RATING) {
      orderBy = { starRating: dto.sortOrder || 'desc' };
    }

    const [total, hotels] = await Promise.all([
      this.prisma.hotel.count({ where }),
      this.prisma.hotel.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          roomTypes: {
            where: {
              isActive: true,
              deletedAt: null,
              maxOccupancy: { gte: guests },
              ...(dto.roomTypeId ? { id: dto.roomTypeId } : {}),
            },
            include: {
              amenities: {
                include: {
                  amenity: {
                    select: {
                      id: true,
                      name: true,
                      iconKey: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    // 2. Transform hotels and compute exact available rooms per room type
    const items: AvailableHotelResult[] = [];

    for (const hotel of hotels) {
      const availableRoomTypes: AvailableRoomTypeResult[] = [];
      let hotelAvailableRoomsCount = 0;

      for (const rt of hotel.roomTypes) {
        const summary = await this.getRoomTypeAvailability(
          rt.id,
          checkInDate,
          checkOutDate,
        );

        if (summary.availableRooms >= roomsRequested) {
          availableRoomTypes.push({
            id: rt.id,
            roomTypeId: rt.id,
            name: rt.name,
            slug: rt.slug,
            description: rt.description,
            maxOccupancy: rt.maxOccupancy,
            maxAdults: rt.maxAdults,
            maxChildren: rt.maxChildren,
            basePriceCents: rt.basePriceCents.toString(),
            currency: rt.currency,
            bedType: rt.bedType,
            sizeSqMeters: rt.sizeSqMeters ? Number(rt.sizeSqMeters) : null,
            availableRooms: summary.availableRooms,
            totalRooms: summary.totalOperationalRooms,
            totalOperationalRooms: summary.totalOperationalRooms,
            amenities: rt.amenities.map((a) => a.amenity),
          });
          hotelAvailableRoomsCount += summary.availableRooms;
        }
      }

      if (availableRoomTypes.length > 0) {
        const minPrice = availableRoomTypes.reduce((min, rt) => {
          const p = BigInt(rt.basePriceCents);
          return p < min ? p : min;
        }, BigInt(availableRoomTypes[0].basePriceCents));

        items.push({
          id: hotel.id,
          hotelId: hotel.id,
          name: hotel.name,
          hotelName: hotel.name,
          slug: hotel.slug,
          description: hotel.description,
          starRating: hotel.starRating,
          addressLine1: hotel.addressLine1,
          addressLine2: hotel.addressLine2,
          city: hotel.city,
          state: hotel.state,
          country: hotel.country,
          postalCode: hotel.postalCode,
          latitude: hotel.latitude ? Number(hotel.latitude) : null,
          longitude: hotel.longitude ? Number(hotel.longitude) : null,
          phone: hotel.phone,
          email: hotel.email,
          checkInTime: hotel.checkInTime,
          checkOutTime: hotel.checkOutTime,
          minPriceCents: minPrice.toString(),
          totalAvailableRooms: hotelAvailableRoomsCount,
          roomTypes: availableRoomTypes,
        });
      }
    }

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
        checkIn: dto.checkIn,
        checkOut: dto.checkOut,
        totalNights: nights,
        guests,
        rooms: roomsRequested,
      },
    };
  }
}
