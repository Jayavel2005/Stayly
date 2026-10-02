import { Injectable, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { DomainException } from '../../../common/exceptions/domain.exception';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { UserRole } from '../../auth/types/user-role.enum';

export interface HotelAccessOptions {
  /**
   * If true, non-assigned access attempts will return 404 NOT_FOUND instead of 403 FORBIDDEN
   * to prevent resource existence disclosure (IDOR defense).
   */
  hideExistence?: boolean;
}

@Injectable()
export class HotelAuthorizationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Asserts that a manager is actively assigned to the specified hotel property.
   * Throws DomainException (403 FORBIDDEN or 404 NOT_FOUND) if unauthorized.
   *
   * @param managerId UUID of the authenticated manager
   * @param hotelId UUID of the target hotel property
   * @param options Optional configuration for information leakage defense
   */
  async assertManagerAccess(
    managerId: string,
    hotelId: string,
    options?: HotelAccessOptions,
  ): Promise<void> {
    // 1. Verify that the hotel exists and is not soft-deleted
    const hotel = await this.prisma.hotel.findFirst({
      where: {
        id: hotelId,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!hotel) {
      throw new DomainException(
        'NOT_FOUND',
        'Hotel property not found.',
        HttpStatus.NOT_FOUND,
      );
    }

    // 2. Query authoritative hotel_managers join table
    const assignment = await this.prisma.hotelManager.findUnique({
      where: {
        userId_hotelId: {
          userId: managerId,
          hotelId,
        },
      },
    });

    if (!assignment) {
      if (options?.hideExistence) {
        throw new DomainException(
          'NOT_FOUND',
          'Hotel property not found.',
          HttpStatus.NOT_FOUND,
        );
      }

      throw new DomainException(
        'FORBIDDEN',
        'Access denied. You are not assigned to manage this hotel property.',
        HttpStatus.FORBIDDEN,
      );
    }
  }

  /**
   * Checks whether a manager can access a hotel without throwing exceptions.
   */
  async canManagerAccessHotel(
    managerId: string,
    hotelId: string,
  ): Promise<boolean> {
    try {
      await this.assertManagerAccess(managerId, hotelId);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Returns an array of hotel IDs assigned to the given manager.
   * Useful for query scoping (e.g. Prisma WHERE in list).
   */
  async getManagedHotelIds(managerId: string): Promise<string[]> {
    const assignments = await this.prisma.hotelManager.findMany({
      where: { userId: managerId },
      select: { hotelId: true },
    });

    return assignments.map((a) => a.hotelId);
  }

  /**
   * Composite authorization check allowing ADMIN unconditional operational access,
   * while requiring HOTEL_MANAGER to have an explicit assignment in hotel_managers.
   */
  async assertAdminOrManagerAccess(
    user: AuthenticatedUser,
    hotelId: string,
    options?: HotelAccessOptions,
  ): Promise<void> {
    if (user.role === UserRole.ADMIN) {
      // Admins have platform-level oversight; ensure hotel exists
      const hotel = await this.prisma.hotel.findFirst({
        where: { id: hotelId, deletedAt: null },
        select: { id: true },
      });
      if (!hotel) {
        throw new DomainException(
          'NOT_FOUND',
          'Hotel property not found.',
          HttpStatus.NOT_FOUND,
        );
      }
      return;
    }

    if (
      user.role === UserRole.HOTEL_MANAGER ||
      user.role === 'MANAGER'
    ) {
      await this.assertManagerAccess(user.id, hotelId, options);
      return;
    }

    throw new DomainException(
      'FORBIDDEN',
      'You do not have permission to access this hotel resource.',
      HttpStatus.FORBIDDEN,
    );
  }
}
