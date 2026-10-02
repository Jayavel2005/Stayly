import {
  Injectable,
  HttpStatus,
  Logger,
  Optional,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DomainException } from '../../common/exceptions/domain.exception';
import { UserRole, UserStatus } from '../auth/types/user-role.enum';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { RedisKeys } from '../../infrastructure/redis/redis-keys';
import { RealtimeService } from '../../infrastructure/realtime/realtime.service';
import { RealtimeEventType } from '../../infrastructure/realtime/realtime.events';

import { AdminDashboardQueryDto } from './dto/admin-dashboard-query.dto';
import { AdminQueryUsersDto } from './dto/admin-query-users.dto';
import { AdminUpdateUserStatusDto } from './dto/admin-update-user-status.dto';
import { AdminQueryManagersDto } from './dto/admin-query-managers.dto';
import { AdminAssignManagerDto } from './dto/admin-assign-manager.dto';
import { AdminQueryHotelsDto } from './dto/admin-query-hotels.dto';
import { AdminUpdateHotelStatusDto } from './dto/admin-update-hotel-status.dto';
import { AdminQueryBookingsDto } from './dto/admin-query-bookings.dto';
import { AdminQueryPaymentsDto } from './dto/admin-query-payments.dto';
import { AdminQueryReviewsDto } from './dto/admin-query-reviews.dto';
import { AdminModerateReviewDto } from './dto/admin-moderate-review.dto';
import { AdminQueryNotificationsDto } from './dto/admin-query-notifications.dto';

import { AdminDashboardResponse } from './types/admin-dashboard.types';
import { PaginatedResponse } from './types/admin.types';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly redisService?: RedisService,
    @Optional() private readonly realtimeService?: RealtimeService,
  ) {}

  // ===========================================================================
  // 1. Dashboard Overview & Database-Level Aggregations
  // ===========================================================================

  async getDashboardStats(query: AdminDashboardQueryDto): Promise<AdminDashboardResponse> {
    if (query.from && query.to) {
      const fromDate = new Date(query.from);
      const toDate = new Date(query.to);
      if (fromDate.getTime() > toDate.getTime()) {
        throw new DomainException(
          'INVALID_DATE_RANGE',
          'The "from" date must be earlier than or equal to the "to" date.',
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const dateFilter: Prisma.DateTimeFilter | undefined =
      query.from || query.to
        ? {
            ...(query.from && { gte: new Date(query.from) }),
            ...(query.to && { lte: new Date(query.to) }),
          }
        : undefined;

    const bookingWhere: Prisma.BookingWhereInput = dateFilter ? { createdAt: dateFilter } : {};
    const paymentWhere: Prisma.PaymentWhereInput = dateFilter ? { createdAt: dateFilter } : {};
    const reviewWhere: Prisma.ReviewWhereInput = dateFilter ? { createdAt: dateFilter } : {};

    // Execute efficient database-side aggregations concurrently
    const [
      totalUsers,
      activeUsers,
      totalCustomers,
      totalManagers,
      suspendedUsers,
      totalHotels,
      activeHotels,
      inactiveHotels,
      totalRoomTypes,
      totalRooms,
      totalBookings,
      bookingsByStatus,
      totalPayments,
      paymentsByStatus,
      totalReviews,
      publishedReviews,
      avgReviewRating,
      totalNotifications,
      unreadNotifications,
    ] = await Promise.all([
      // Users
      this.prisma.user.count(),
      this.prisma.user.count({ where: { status: UserStatus.ACTIVE } }),
      this.prisma.user.count({ where: { role: UserRole.CUSTOMER } }),
      this.prisma.user.count({
        where: { role: { in: [UserRole.HOTEL_MANAGER, 'MANAGER'] } },
      }),
      this.prisma.user.count({ where: { status: UserStatus.SUSPENDED } }),

      // Hotels
      this.prisma.hotel.count({ where: { deletedAt: null } }),
      this.prisma.hotel.count({ where: { isActive: true, deletedAt: null } }),
      this.prisma.hotel.count({ where: { isActive: false, deletedAt: null } }),

      // Inventory
      this.prisma.roomType.count({ where: { deletedAt: null } }),
      this.prisma.room.count({ where: { deletedAt: null } }),

      // Bookings (filtered by date if provided)
      this.prisma.booking.count({ where: bookingWhere }),
      this.prisma.booking.groupBy({
        by: ['status'],
        _count: { id: true },
        where: bookingWhere,
      }),

      // Payments (filtered by date if provided)
      this.prisma.payment.count({ where: paymentWhere }),
      this.prisma.payment.groupBy({
        by: ['status'],
        _count: { id: true },
        _sum: { amountCents: true },
        where: paymentWhere,
      }),

      // Reviews
      this.prisma.review.count({ where: reviewWhere }),
      this.prisma.review.count({ where: { isPublished: true, ...reviewWhere } }),
      this.prisma.review.aggregate({
        _avg: { rating: true },
        where: reviewWhere,
      }),

      // Notifications
      this.prisma.notification.count(),
      this.prisma.notification.count({ where: { isRead: false } }),
    ]);

    // Format Bookings
    const bookingStatusMap: Record<string, number> = {};
    for (const b of bookingsByStatus) {
      bookingStatusMap[b.status] = b._count.id;
    }

    // Format Payments & Precise Financial Total
    let paymentCompletedCount = 0;
    let paymentFailedCount = 0;
    let paymentPendingCount = 0;
    let totalRevenueCents = 0;

    for (const p of paymentsByStatus) {
      if (p.status === 'SUCCEEDED' || p.status === 'COMPLETED') {
        paymentCompletedCount = p._count.id;
        totalRevenueCents = Number(p._sum.amountCents || 0);
      } else if (p.status === 'FAILED') {
        paymentFailedCount = p._count.id;
      } else if (p.status === 'PENDING') {
        paymentPendingCount = p._count.id;
      }
    }

    return {
      dateRange: {
        from: query.from || null,
        to: query.to || null,
      },
      users: {
        totalUsers,
        activeUsers,
        totalCustomers,
        totalManagers,
        suspendedUsers,
      },
      hotels: {
        totalHotels,
        activeHotels,
        inactiveHotels,
      },
      inventory: {
        totalRoomTypes,
        totalRooms,
      },
      bookings: {
        totalBookings,
        pending: bookingStatusMap['PENDING'] || 0,
        confirmed: bookingStatusMap['CONFIRMED'] || 0,
        checkedIn: bookingStatusMap['CHECKED_IN'] || 0,
        checkedOut: bookingStatusMap['CHECKED_OUT'] || 0,
        cancelled: bookingStatusMap['CANCELLED'] || 0,
        noShow: bookingStatusMap['NO_SHOW'] || 0,
      },
      payments: {
        totalPayments,
        completed: paymentCompletedCount,
        failed: paymentFailedCount,
        pending: paymentPendingCount,
        totalRevenueCents,
      },
      reviews: {
        totalReviews,
        publishedReviews,
        averageRating: avgReviewRating._avg.rating
          ? Number(avgReviewRating._avg.rating.toFixed(2))
          : null,
      },
      notifications: {
        totalNotifications,
        unreadNotifications,
      },
    };
  }

  // ===========================================================================
  // 2. User Management
  // ===========================================================================

  async getUsers(query: AdminQueryUsersDto): Promise<PaginatedResponse<any>> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(query.role && { role: query.role }),
      ...(query.status && { status: query.status }),
      ...(query.search && {
        OR: [
          { email: { contains: query.search, mode: 'insensitive' } },
          { firstName: { contains: query.search, mode: 'insensitive' } },
          { lastName: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
    };

    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder || 'desc';

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          role: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          deletedAt: true,
          _count: {
            select: {
              bookings: true,
              hotelManagers: true,
              reviews: true,
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
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

  async getUserById(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
        hotelManagers: {
          select: {
            hotelId: true,
            isPrimary: true,
            assignedAt: true,
            hotel: {
              select: {
                id: true,
                name: true,
                city: true,
                isActive: true,
              },
            },
          },
        },
        _count: {
          select: {
            bookings: true,
            reviews: true,
            notifications: true,
          },
        },
      },
    });

    if (!user) {
      throw new DomainException('NOT_FOUND', 'User account not found.', HttpStatus.NOT_FOUND);
    }

    return user;
  }

  async updateUserStatus(
    id: string,
    dto: AdminUpdateUserStatusDto,
    adminUser: AuthenticatedUser,
  ) {
    // Admin Self-Protection Rule: Cannot disable or suspend one's own account
    if (id === adminUser.id) {
      throw new DomainException(
        'ADMIN_SELF_PROTECTION',
        'Admins are forbidden from modifying their own account status.',
        HttpStatus.FORBIDDEN,
      );
    }

    const targetUser = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!targetUser || targetUser.deletedAt !== null) {
      throw new DomainException('NOT_FOUND', 'Target user account not found.', HttpStatus.NOT_FOUND);
    }

    if (targetUser.status === dto.status) {
      return this.getUserById(id);
    }

    const oldStatus = targetUser.status;

    // Execute status transition and audit log in an atomic transaction
    const updated = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id },
        data: { status: dto.status },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          role: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      // If user is suspended or disabled, invalidate active refresh tokens immediately
      if (dto.status === UserStatus.SUSPENDED || dto.status === UserStatus.DISABLED) {
        await tx.refreshToken.deleteMany({
          where: { userId: id },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: adminUser.id,
          action: 'admin.user.status_updated',
          entityType: 'User',
          entityId: id,
          oldValues: { status: oldStatus },
          newValues: { status: dto.status, reason: dto.reason || null },
        },
      });

      return user;
    });

    // Realtime SSE event emission (post-commit)
    if (this.realtimeService) {
      this.realtimeService
        .publish(
          RealtimeEventType.USER_STATUS_CHANGED,
          {
            userId: updated.id,
            email: updated.email,
            previousStatus: oldStatus,
            newStatus: updated.status,
            reason: dto.reason || null,
          },
          {
            userId: updated.id,
            includeAdmins: true,
          },
        )
        .catch((err) => {
          this.logger.warn(`Failed to emit USER_STATUS_CHANGED event: ${err.message}`);
        });
    }

    return updated;
  }

  // ===========================================================================
  // 3. Manager Management & Property Assignments
  // ===========================================================================

  async getManagers(query: AdminQueryManagersDto): Promise<PaginatedResponse<any>> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {
      role: { in: [UserRole.HOTEL_MANAGER, 'MANAGER'] },
      deletedAt: null,
      ...(query.status && { status: query.status }),
      ...(query.search && {
        OR: [
          { email: { contains: query.search, mode: 'insensitive' } },
          { firstName: { contains: query.search, mode: 'insensitive' } },
          { lastName: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
    };

    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder || 'desc';

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          role: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          hotelManagers: {
            select: {
              hotelId: true,
              isPrimary: true,
              assignedAt: true,
              hotel: {
                select: {
                  id: true,
                  name: true,
                  city: true,
                  isActive: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
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

  async getManagerById(id: string) {
    const manager = await this.prisma.user.findFirst({
      where: {
        id,
        role: { in: [UserRole.HOTEL_MANAGER, 'MANAGER'] },
        deletedAt: null,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        hotelManagers: {
          select: {
            hotelId: true,
            isPrimary: true,
            assignedAt: true,
            hotel: {
              select: {
                id: true,
                name: true,
                slug: true,
                city: true,
                state: true,
                isActive: true,
              },
            },
          },
        },
      },
    });

    if (!manager) {
      throw new DomainException(
        'NOT_FOUND',
        'Hotel manager account not found.',
        HttpStatus.NOT_FOUND,
      );
    }

    return manager;
  }

  async assignManager(
    hotelId: string,
    managerId: string,
    dto: AdminAssignManagerDto,
    adminUser: AuthenticatedUser,
  ) {
    // Verify Hotel Exists
    const hotel = await this.prisma.hotel.findFirst({
      where: { id: hotelId, deletedAt: null },
    });
    if (!hotel) {
      throw new DomainException('NOT_FOUND', 'Hotel property not found.', HttpStatus.NOT_FOUND);
    }

    // Verify Manager Exists and Has HOTEL_MANAGER Role
    const manager = await this.prisma.user.findFirst({
      where: { id: managerId, deletedAt: null },
    });
    if (!manager) {
      throw new DomainException('NOT_FOUND', 'Manager user account not found.', HttpStatus.NOT_FOUND);
    }
    if (manager.role !== UserRole.HOTEL_MANAGER && manager.role !== 'MANAGER') {
      throw new DomainException(
        'INVALID_USER_ROLE',
        'The specified user is not registered as a hotel manager.',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (manager.status !== UserStatus.ACTIVE) {
      throw new DomainException(
        'INACTIVE_MANAGER',
        `Cannot assign manager with account status: ${manager.status}.`,
        HttpStatus.BAD_REQUEST,
      );
    }

    // Idempotent upsert & AuditLog inside a transaction with concurrency protection
    let assignment: any;
    try {
      assignment = await this.prisma.$transaction(async (tx: any) => {
        const record = await tx.hotelManager.upsert({
          where: {
            userId_hotelId: {
              userId: managerId,
              hotelId,
            },
          },
          update: {
            isPrimary: dto.isPrimary ?? false,
          },
          create: {
            userId: managerId,
            hotelId,
            isPrimary: dto.isPrimary ?? false,
          },
          include: {
            hotel: { select: { id: true, name: true, city: true } },
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        });

        await tx.auditLog.create({
          data: {
            actorId: adminUser.id,
            action: 'admin.manager.assigned',
            entityType: 'HotelManager',
            entityId: record.id,
            newValues: {
              hotelId,
              managerId,
              isPrimary: dto.isPrimary ?? false,
            },
          },
        });

        return record;
      });
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        // Race condition: another concurrent transaction created the record. Retrieve existing record.
        assignment = await this.prisma.hotelManager.findUnique({
          where: {
            userId_hotelId: {
              userId: managerId,
              hotelId,
            },
          },
          include: {
            hotel: { select: { id: true, name: true, city: true } },
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        });
      } else {
        throw err;
      }
    }

    // Realtime SSE event emission (post-commit)
    if (this.realtimeService) {
      this.realtimeService
        .publish(
          RealtimeEventType.MANAGER_ASSIGNMENT_CHANGED,
          {
            assignmentId: assignment.id,
            hotelId,
            managerId,
            action: 'ASSIGNED',
            isPrimary: assignment.isPrimary,
          },
          {
            hotelId,
            userId: managerId,
            includeAdmins: true,
          },
        )
        .catch((err) => {
          this.logger.warn(`Failed to emit MANAGER_ASSIGNMENT_CHANGED event: ${err.message}`);
        });
    }

    return assignment;
  }

  async unassignManager(
    hotelId: string,
    managerId: string,
    adminUser: AuthenticatedUser,
  ) {
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

    await this.prisma.$transaction(async (tx) => {
      await tx.hotelManager.delete({
        where: { id: assignment.id },
      });

      await tx.auditLog.create({
        data: {
          actorId: adminUser.id,
          action: 'admin.manager.unassigned',
          entityType: 'HotelManager',
          entityId: assignment.id,
          oldValues: {
            hotelId,
            managerId,
            isPrimary: assignment.isPrimary,
          },
        },
      });
    });

    // Realtime SSE event emission (post-commit)
    if (this.realtimeService) {
      this.realtimeService
        .publish(
          RealtimeEventType.MANAGER_ASSIGNMENT_CHANGED,
          {
            assignmentId: assignment.id,
            hotelId,
            managerId,
            action: 'UNASSIGNED',
          },
          {
            hotelId,
            userId: managerId,
            includeAdmins: true,
          },
        )
        .catch((err) => {
          this.logger.warn(`Failed to emit MANAGER_ASSIGNMENT_CHANGED event: ${err.message}`);
        });
    }

    return { message: 'Manager assignment removed successfully.' };
  }

  // ===========================================================================
  // 4. Hotel Administration
  // ===========================================================================

  async getHotels(query: AdminQueryHotelsDto): Promise<PaginatedResponse<any>> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.HotelWhereInput = {
      deletedAt: null,
      ...(query.isActive !== undefined && { isActive: query.isActive }),
      ...(query.city && { city: { contains: query.city, mode: 'insensitive' } }),
      ...(query.state && { state: { contains: query.state, mode: 'insensitive' } }),
      ...(query.search && {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { description: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
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
              bookings: true,
              managers: true,
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

  async getHotelById(id: string) {
    const hotel = await this.prisma.hotel.findFirst({
      where: { id, deletedAt: null },
      include: {
        roomTypes: {
          where: { deletedAt: null },
          select: {
            id: true,
            name: true,
            slug: true,
            maxOccupancy: true,
            basePriceCents: true,
            currency: true,
            isActive: true,
          },
        },
        rooms: {
          where: { deletedAt: null },
          select: {
            id: true,
            roomNumber: true,
            floor: true,
            operationalStatus: true,
          },
        },
        managers: {
          select: {
            isPrimary: true,
            assignedAt: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                status: true,
              },
            },
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
      throw new DomainException('NOT_FOUND', 'Hotel property not found.', HttpStatus.NOT_FOUND);
    }

    return hotel;
  }

  async updateHotelStatus(
    id: string,
    dto: AdminUpdateHotelStatusDto,
    adminUser: AuthenticatedUser,
  ) {
    const hotel = await this.prisma.hotel.findFirst({
      where: { id, deletedAt: null },
    });

    if (!hotel) {
      throw new DomainException('NOT_FOUND', 'Hotel property not found.', HttpStatus.NOT_FOUND);
    }

    let preservedActiveBookingsCount = 0;

    // Safety rule for deactivation:
    // Check if there are active bookings. Deactivation is permitted to stop NEW bookings,
    // but existing confirmed/checked-in bookings are STRICTLY PRESERVED without corruption.
    if (!dto.isActive && hotel.isActive) {
      preservedActiveBookingsCount = await this.prisma.booking.count({
        where: {
          hotelId: id,
          status: { in: ['CONFIRMED', 'CHECKED_IN'] },
        },
      });
    }

    const oldIsActive = hotel.isActive;

    const updated = await this.prisma.$transaction(async (tx) => {
      const record = await tx.hotel.update({
        where: { id },
        data: { isActive: dto.isActive },
      });

      await tx.auditLog.create({
        data: {
          actorId: adminUser.id,
          action: 'admin.hotel.status_updated',
          entityType: 'Hotel',
          entityId: id,
          oldValues: { isActive: oldIsActive },
          newValues: {
            isActive: dto.isActive,
            reason: dto.reason || null,
            preservedActiveBookings: preservedActiveBookingsCount,
          },
        },
      });

      return record;
    });

    // Invalidate Redis Cache
    if (this.redisService) {
      await this.redisService.delete(RedisKeys.hotel(id));
    }

    // Realtime SSE event emission (post-commit)
    if (this.realtimeService) {
      this.realtimeService
        .publish(
          RealtimeEventType.HOTEL_STATUS_CHANGED,
          {
            hotelId: id,
            hotelName: updated.name,
            previousIsActive: oldIsActive,
            newIsActive: updated.isActive,
            preservedActiveBookings: preservedActiveBookingsCount,
          },
          {
            hotelId: id,
            includeAdmins: true,
          },
        )
        .catch((err) => {
          this.logger.warn(`Failed to emit HOTEL_STATUS_CHANGED event: ${err.message}`);
        });
    }

    return {
      ...updated,
      preservedActiveBookings: preservedActiveBookingsCount,
    };
  }

  // ===========================================================================
  // 5. Booking Administration (Platform-Wide Inspection)
  // ===========================================================================

  async getBookings(query: AdminQueryBookingsDto): Promise<PaginatedResponse<any>> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.BookingWhereInput = {
      ...(query.status && { status: query.status }),
      ...(query.hotelId && { hotelId: query.hotelId }),
      ...(query.customerId && { customerId: query.customerId }),
      ...(query.bookingReference && {
        bookingReference: { contains: query.bookingReference, mode: 'insensitive' },
      }),
      ...(query.checkInFrom || query.checkInTo
        ? {
            checkInDate: {
              ...(query.checkInFrom && { gte: new Date(query.checkInFrom) }),
              ...(query.checkInTo && { lte: new Date(query.checkInTo) }),
            },
          }
        : {}),
      ...(query.createdAtFrom || query.createdAtTo
        ? {
            createdAt: {
              ...(query.createdAtFrom && { gte: new Date(query.createdAtFrom) }),
              ...(query.createdAtTo && { lte: new Date(query.createdAtTo) }),
            },
          }
        : {}),
    };

    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder || 'desc';

    const [items, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
          hotel: {
            select: {
              id: true,
              name: true,
              city: true,
              state: true,
            },
          },
          payment: {
            select: {
              id: true,
              status: true,
              amountCents: true,
              currency: true,
              settledAt: true,
            },
          },
        },
      }),
      this.prisma.booking.count({ where }),
    ]);

    const formattedItems = items.map((b) => ({
      ...b,
      totalAmountCents: Number(b.totalAmountCents),
      payment: b.payment
        ? {
            ...b.payment,
            amountCents: Number(b.payment.amountCents),
          }
        : null,
    }));

    return {
      items: formattedItems,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async getBookingById(id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        hotel: {
          select: {
            id: true,
            name: true,
            slug: true,
            city: true,
            state: true,
            country: true,
            addressLine1: true,
            phone: true,
            email: true,
          },
        },
        bookingRooms: {
          include: {
            room: {
              select: {
                id: true,
                roomNumber: true,
                floor: true,
                operationalStatus: true,
              },
            },
            roomType: {
              select: {
                id: true,
                name: true,
                slug: true,
                bedType: true,
              },
            },
          },
        },
        priceSnapshot: true,
        guests: true,
        payment: {
          include: {
            attempts: {
              select: {
                id: true,
                attemptNumber: true,
                amountCents: true,
                status: true,
                gatewayProvider: true,
                paymentMethod: true,
                failureReason: true,
                createdAt: true,
              },
            },
            refunds: true,
          },
        },
        review: true,
      },
    });

    if (!booking) {
      throw new DomainException('NOT_FOUND', 'Reservation record not found.', HttpStatus.NOT_FOUND);
    }

    return {
      ...booking,
      totalAmountCents: Number(booking.totalAmountCents),
      priceSnapshot: booking.priceSnapshot
        ? {
            ...booking.priceSnapshot,
            baseRateCents: Number(booking.priceSnapshot.baseRateCents),
            grossRoomCents: Number(booking.priceSnapshot.grossRoomCents),
            taxCents: Number(booking.priceSnapshot.taxCents),
            serviceFeeCents: Number(booking.priceSnapshot.serviceFeeCents),
            discountCents: Number(booking.priceSnapshot.discountCents),
            netAmountCents: Number(booking.priceSnapshot.netAmountCents),
          }
        : null,
      payment: booking.payment
        ? {
            ...booking.payment,
            amountCents: Number(booking.payment.amountCents),
            attempts: booking.payment.attempts.map((a) => ({
              ...a,
              amountCents: Number(a.amountCents),
            })),
            refunds: booking.payment.refunds.map((r) => ({
              ...r,
              amountCents: Number(r.amountCents),
            })),
          }
        : null,
    };
  }

  // ===========================================================================
  // 6. Payment Administration (Platform-Wide Ledger Inspection)
  // ===========================================================================

  async getPayments(query: AdminQueryPaymentsDto): Promise<PaginatedResponse<any>> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.PaymentWhereInput = {
      ...(query.status && { status: query.status }),
      ...(query.bookingId && { bookingId: query.bookingId }),
      ...(query.gatewayProvider && { gatewayProvider: query.gatewayProvider }),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from && { gte: new Date(query.from) }),
              ...(query.to && { lte: new Date(query.to) }),
            },
          }
        : {}),
    };

    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder || 'desc';

    const [items, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          booking: {
            select: {
              id: true,
              bookingReference: true,
              customerId: true,
              hotelId: true,
              customer: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.payment.count({ where }),
    ]);

    const formattedItems = items.map((p) => ({
      id: p.id,
      bookingId: p.bookingId,
      transactionReference: p.transactionReference,
      amountCents: Number(p.amountCents),
      currency: p.currency,
      status: p.status,
      gatewayProvider: p.gatewayProvider,
      paymentMethod: p.paymentMethod,
      failureReason: p.failureReason,
      createdAt: p.createdAt,
      settledAt: p.settledAt,
      booking: p.booking,
    }));

    return {
      items: formattedItems,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async getPaymentById(id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        booking: {
          select: {
            id: true,
            bookingReference: true,
            status: true,
            customerId: true,
            hotelId: true,
            customer: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        attempts: {
          select: {
            id: true,
            attemptNumber: true,
            amountCents: true,
            status: true,
            gatewayProvider: true,
            paymentMethod: true,
            failureReason: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        refunds: true,
      },
    });

    if (!payment) {
      throw new DomainException('NOT_FOUND', 'Payment transaction not found.', HttpStatus.NOT_FOUND);
    }

    return {
      id: payment.id,
      bookingId: payment.bookingId,
      transactionReference: payment.transactionReference,
      amountCents: Number(payment.amountCents),
      currency: payment.currency,
      status: payment.status,
      gatewayProvider: payment.gatewayProvider,
      paymentMethod: payment.paymentMethod,
      failureReason: payment.failureReason,
      createdAt: payment.createdAt,
      settledAt: payment.settledAt,
      booking: payment.booking,
      attempts: payment.attempts.map((a) => ({
        ...a,
        amountCents: Number(a.amountCents),
      })),
      refunds: payment.refunds.map((r) => ({
        ...r,
        amountCents: Number(r.amountCents),
      })),
    };
  }

  // ===========================================================================
  // 7. Review Moderation
  // ===========================================================================

  async getReviews(query: AdminQueryReviewsDto): Promise<PaginatedResponse<any>> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.ReviewWhereInput = {
      ...(query.hotelId && { hotelId: query.hotelId }),
      ...(query.customerId && { customerId: query.customerId }),
      ...(query.rating !== undefined && { rating: query.rating }),
      ...(query.isPublished !== undefined && { isPublished: query.isPublished }),
    };

    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder || 'desc';

    const [items, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
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
      this.prisma.review.count({ where }),
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

  async getReviewById(id: string) {
    const review = await this.prisma.review.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
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

    if (!review) {
      throw new DomainException('NOT_FOUND', 'Review not found.', HttpStatus.NOT_FOUND);
    }

    return review;
  }

  async moderateReview(
    id: string,
    dto: AdminModerateReviewDto,
    adminUser: AuthenticatedUser,
  ) {
    const review = await this.prisma.review.findUnique({
      where: { id },
    });

    if (!review) {
      throw new DomainException('NOT_FOUND', 'Review not found.', HttpStatus.NOT_FOUND);
    }

    const oldIsPublished = review.isPublished;

    const updated = await this.prisma.$transaction(async (tx) => {
      const record = await tx.review.update({
        where: { id },
        data: { isPublished: dto.isPublished },
      });

      await tx.auditLog.create({
        data: {
          actorId: adminUser.id,
          action: 'admin.review.moderated',
          entityType: 'Review',
          entityId: id,
          oldValues: { isPublished: oldIsPublished },
          newValues: {
            isPublished: dto.isPublished,
            moderationReason: dto.moderationReason || null,
          },
        },
      });

      return record;
    });

    return updated;
  }

  // ===========================================================================
  // 8. Notification Administration
  // ===========================================================================

  async getNotifications(query: AdminQueryNotificationsDto): Promise<PaginatedResponse<any>> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.NotificationWhereInput = {
      ...(query.userId && { userId: query.userId }),
      ...(query.type && { type: query.type }),
      ...(query.isRead !== undefined && { isRead: query.isRead }),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from && { gte: new Date(query.from) }),
              ...(query.to && { lte: new Date(query.to) }),
            },
          }
        : {}),
    };

    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder || 'desc';

    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
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
      }),
      this.prisma.notification.count({ where }),
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
}
