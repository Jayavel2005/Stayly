import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { RealtimeService } from '../../infrastructure/realtime/realtime.service';
import { UserRole, UserStatus } from '../auth/types/user-role.enum';
import { DomainException } from '../../common/exceptions/domain.exception';

describe('AdminService', () => {
  let service: AdminService;
  let prisma: any;
  let redisService: any;
  let realtimeService: any;

  const mockAdminUser = {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'admin@stayora.com',
    role: UserRole.ADMIN,
    status: UserStatus.ACTIVE,
  };

  beforeEach(async () => {
    prisma = {
      user: {
        count: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      hotel: {
        count: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      roomType: {
        count: jest.fn(),
      },
      room: {
        count: jest.fn(),
      },
      booking: {
        count: jest.fn(),
        groupBy: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      payment: {
        count: jest.fn(),
        groupBy: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      review: {
        count: jest.fn(),
        aggregate: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      notification: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      hotelManager: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
        delete: jest.fn(),
      },
      refreshToken: {
        deleteMany: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(prisma)),
    };

    redisService = {
      delete: jest.fn().mockResolvedValue(true),
    };

    realtimeService = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redisService },
        { provide: RealtimeService, useValue: realtimeService },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  describe('getDashboardStats', () => {
    it('should calculate aggregated platform metrics from database queries', async () => {
      prisma.user.count
        .mockResolvedValueOnce(100) // totalUsers
        .mockResolvedValueOnce(90) // activeUsers
        .mockResolvedValueOnce(80) // totalCustomers
        .mockResolvedValueOnce(15) // totalManagers
        .mockResolvedValueOnce(5); // suspendedUsers

      prisma.hotel.count
        .mockResolvedValueOnce(10) // totalHotels
        .mockResolvedValueOnce(8) // activeHotels
        .mockResolvedValueOnce(2); // inactiveHotels

      prisma.roomType.count.mockResolvedValueOnce(30);
      prisma.room.count.mockResolvedValueOnce(120);

      prisma.booking.count.mockResolvedValueOnce(250);
      prisma.booking.groupBy.mockResolvedValueOnce([
        { status: 'CONFIRMED', _count: { id: 150 } },
        { status: 'PENDING', _count: { id: 30 } },
        { status: 'CHECKED_IN', _count: { id: 20 } },
        { status: 'CHECKED_OUT', _count: { id: 40 } },
        { status: 'CANCELLED', _count: { id: 10 } },
      ]);

      prisma.payment.count.mockResolvedValueOnce(200);
      prisma.payment.groupBy.mockResolvedValueOnce([
        { status: 'COMPLETED', _count: { id: 180 }, _sum: { amountCents: BigInt(5400000) } },
        { status: 'FAILED', _count: { id: 20 }, _sum: { amountCents: BigInt(600000) } },
      ]);

      prisma.review.count
        .mockResolvedValueOnce(75) // totalReviews
        .mockResolvedValueOnce(70); // publishedReviews
      prisma.review.aggregate.mockResolvedValueOnce({ _avg: { rating: 4.678 } });

      prisma.notification.count
        .mockResolvedValueOnce(500)
        .mockResolvedValueOnce(45);

      const stats = await service.getDashboardStats({});

      expect(stats.users.totalUsers).toBe(100);
      expect(stats.users.activeUsers).toBe(90);
      expect(stats.hotels.totalHotels).toBe(10);
      expect(stats.hotels.activeHotels).toBe(8);
      expect(stats.bookings.confirmed).toBe(150);
      expect(stats.bookings.pending).toBe(30);
      expect(stats.payments.completed).toBe(180);
      expect(stats.payments.totalRevenueCents).toBe(5400000);
      expect(stats.reviews.averageRating).toBe(4.68);
      expect(stats.notifications.unreadNotifications).toBe(45);
    });

    it('should throw DomainException if from date is after to date', async () => {
      await expect(
        service.getDashboardStats({
          from: '2026-10-15T00:00:00.000Z',
          to: '2026-10-01T00:00:00.000Z',
        }),
      ).rejects.toThrow(DomainException);
    });
  });

  describe('updateUserStatus & Admin Self-Protection', () => {
    it('should reject status modification if admin attempts to modify their own account', async () => {
      await expect(
        service.updateUserStatus(
          mockAdminUser.id,
          { status: UserStatus.SUSPENDED, reason: 'Accidental lockout' },
          mockAdminUser,
        ),
      ).rejects.toThrow('Admins are forbidden from modifying their own account status.');
    });

    it('should update user status, create audit log, invalidate tokens, and publish SSE event', async () => {
      const targetUserId = '22222222-2222-4222-8222-222222222222';
      prisma.user.findUnique.mockResolvedValueOnce({
        id: targetUserId,
        status: UserStatus.ACTIVE,
        email: 'user@example.com',
        deletedAt: null,
      });

      prisma.user.update.mockResolvedValueOnce({
        id: targetUserId,
        email: 'user@example.com',
        status: UserStatus.SUSPENDED,
      });

      const res = await service.updateUserStatus(
        targetUserId,
        { status: UserStatus.SUSPENDED, reason: 'Payment dispute' },
        mockAdminUser,
      );

      expect(res.status).toBe(UserStatus.SUSPENDED);
      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: targetUserId },
      });
      expect(prisma.auditLog.create).toHaveBeenCalled();
      expect(realtimeService.publish).toHaveBeenCalled();
    });
  });

  describe('assignManager', () => {
    const hotelId = '33333333-3333-4333-8333-333333333333';
    const managerId = '44444444-4444-4444-8444-444444444444';

    it('should reject assignment if target user is not a manager', async () => {
      prisma.hotel.findFirst.mockResolvedValueOnce({ id: hotelId, deletedAt: null });
      prisma.user.findFirst.mockResolvedValueOnce({
        id: managerId,
        role: UserRole.CUSTOMER,
        status: UserStatus.ACTIVE,
        deletedAt: null,
      });

      await expect(
        service.assignManager(hotelId, managerId, { isPrimary: true }, mockAdminUser),
      ).rejects.toThrow('The specified user is not registered as a hotel manager.');
    });

    it('should assign manager to hotel, create audit log, and publish event', async () => {
      prisma.hotel.findFirst.mockResolvedValueOnce({ id: hotelId, deletedAt: null });
      prisma.user.findFirst.mockResolvedValueOnce({
        id: managerId,
        role: UserRole.HOTEL_MANAGER,
        status: UserStatus.ACTIVE,
        deletedAt: null,
      });

      prisma.hotelManager.upsert.mockResolvedValueOnce({
        id: 'assign-uuid-1',
        userId: managerId,
        hotelId,
        isPrimary: true,
      });

      const assignment = await service.assignManager(
        hotelId,
        managerId,
        { isPrimary: true },
        mockAdminUser,
      );

      expect(assignment.id).toBe('assign-uuid-1');
      expect(prisma.auditLog.create).toHaveBeenCalled();
      expect(realtimeService.publish).toHaveBeenCalled();
    });
  });

  describe('updateHotelStatus (Safe Deactivation)', () => {
    const hotelId = '55555555-5555-4555-8555-555555555555';

    it('should safely deactivate hotel while reporting preserved active bookings', async () => {
      prisma.hotel.findFirst.mockResolvedValueOnce({
        id: hotelId,
        isActive: true,
        name: 'Grand Hyatt',
        deletedAt: null,
      });

      // 4 active bookings exist
      prisma.booking.count.mockResolvedValueOnce(4);

      prisma.hotel.update.mockResolvedValueOnce({
        id: hotelId,
        name: 'Grand Hyatt',
        isActive: false,
      });

      const res = await service.updateHotelStatus(
        hotelId,
        { isActive: false, reason: 'Renovation' },
        mockAdminUser,
      );

      expect(res.isActive).toBe(false);
      expect(res.preservedActiveBookings).toBe(4);
      expect(redisService.delete).toHaveBeenCalled();
      expect(prisma.auditLog.create).toHaveBeenCalled();
      expect(realtimeService.publish).toHaveBeenCalled();
    });
  });

  describe('Review Moderation', () => {
    it('should update review isPublished state and log audit entry', async () => {
      const reviewId = '66666666-6666-4666-8666-666666666666';
      prisma.review.findUnique.mockResolvedValueOnce({
        id: reviewId,
        isPublished: true,
      });

      prisma.review.update.mockResolvedValueOnce({
        id: reviewId,
        isPublished: false,
      });

      const res = await service.moderateReview(
        reviewId,
        { isPublished: false, moderationReason: 'Inappropriate language' },
        mockAdminUser,
      );

      expect(res.isPublished).toBe(false);
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'admin.review.moderated',
            entityId: reviewId,
          }),
        }),
      );
    });
  });

  describe('Audit Logs Ledger', () => {
    it('should retrieve paginated audit logs', async () => {
      prisma.auditLog.findMany.mockResolvedValueOnce([
        {
          id: 'log-1',
          action: 'admin.user.status_updated',
          entityType: 'User',
          entityId: 'user-1',
          createdAt: new Date(),
          actor: { id: 'admin-1', email: 'admin@stayora.com' },
        },
      ]);
      prisma.auditLog.count.mockResolvedValueOnce(1);

      const res = await service.getAuditLogs({ page: 1, limit: 10 });
      expect(res.items.length).toBe(1);
      expect(res.meta.total).toBe(1);
      expect(res.meta.totalPages).toBe(1);
    });

    it('should retrieve a single audit log by ID', async () => {
      prisma.auditLog.findUnique.mockResolvedValueOnce({
        id: 'log-1',
        action: 'admin.user.status_updated',
        entityType: 'User',
      });

      const res = await service.getAuditLogById('log-1');
      expect(res.id).toBe('log-1');
    });

    it('should throw DomainException if audit log is not found', async () => {
      prisma.auditLog.findUnique.mockResolvedValueOnce(null);

      await expect(service.getAuditLogById('unknown-log')).rejects.toThrow(
        DomainException,
      );
    });
  });
});

