import { Injectable, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { HotelAuthorizationService } from './authorization/hotel-authorization.service';
import { UpdateHotelDto } from './dto/update-hotel.dto';
import { DomainException } from '../../common/exceptions/domain.exception';

@Injectable()
export class HotelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hotelAuthorizationService: HotelAuthorizationService,
  ) {}

  /**
   * Retrieves all hotels assigned to the authenticated manager.
   */
  async getManagedHotels(managerId: string) {
    const managedIds =
      await this.hotelAuthorizationService.getManagedHotelIds(managerId);

    return this.prisma.hotel.findMany({
      where: {
        id: { in: managedIds },
        deletedAt: null,
      },
      include: {
        _count: {
          select: {
            roomTypes: true,
            rooms: true,
          },
        },
      },
    });
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

    return this.prisma.hotel.update({
      where: { id: hotelId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.description && { description: dto.description }),
        ...(dto.phone && { phone: dto.phone }),
        ...(dto.email && { email: dto.email }),
        ...(dto.starRating && { starRating: dto.starRating }),
      },
    });
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

    return { message: 'Hotel property successfully deactivated.' };
  }

  /**
   * Admin-only overview of all properties across the system.
   */
  async getAllHotelsForAdmin() {
    return this.prisma.hotel.findMany({
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
            rooms: true,
            bookings: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Customer / Public listing of active hotels.
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
