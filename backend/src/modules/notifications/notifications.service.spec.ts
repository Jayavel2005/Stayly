import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../../prisma/prisma.service';
import { DomainException } from '../../common/exceptions/domain.exception';
import { NotificationType } from './types/notification-type.enum';

describe('NotificationsService Unit Tests', () => {
  let service: NotificationsService;
  let prisma: any;

  const mockUserId = '11111111-1111-4111-8111-111111111111';
  const mockOtherUserId = '22222222-2222-4222-8222-222222222222';
  const mockHotelId = '33333333-3333-4333-8333-333333333333';
  const mockNotificationId = '44444444-4444-4444-8444-444444444444';

  const mockNotificationRecord = {
    id: mockNotificationId,
    userId: mockUserId,
    type: NotificationType.BOOKING_CONFIRMED,
    title: 'Booking Confirmed',
    message: 'Your hotel booking has been confirmed.',
    metadata: { bookingId: 'booking-uuid', hotelId: mockHotelId },
    isRead: false,
    readAt: null,
    createdAt: new Date('2026-10-01T12:00:00.000Z'),
  };

  beforeEach(async () => {
    prisma = {
      notification: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      hotelManager: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  describe('create()', () => {
    it('successfully creates and returns a notification', async () => {
      prisma.notification.create.mockResolvedValue(mockNotificationRecord);

      const result = await service.create({
        userId: mockUserId,
        type: NotificationType.BOOKING_CONFIRMED,
        title: 'Booking Confirmed',
        message: 'Your hotel booking has been confirmed.',
        data: { bookingId: 'booking-uuid', hotelId: mockHotelId },
      });

      expect(result).toBeDefined();
      expect(result.id).toBe(mockNotificationId);
      expect(result.type).toBe(NotificationType.BOOKING_CONFIRMED);
      expect(result.isRead).toBe(false);
      expect(result.data).toEqual({ bookingId: 'booking-uuid', hotelId: mockHotelId });
      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: mockUserId,
            type: NotificationType.BOOKING_CONFIRMED,
            title: 'Booking Confirmed',
          }),
        }),
      );
    });
  });

  describe('createForManagersOfHotel()', () => {
    it('dispatches notifications to all managers assigned to the specified hotel', async () => {
      prisma.hotelManager.findMany.mockResolvedValue([
        { userId: 'mgr-1' },
        { userId: 'mgr-2' },
      ]);
      prisma.notification.create.mockResolvedValue(mockNotificationRecord);

      const count = await service.createForManagersOfHotel(mockHotelId, {
        type: NotificationType.BOOKING_CREATED,
        title: 'New Booking Created',
        message: 'A new reservation has been placed.',
      });

      expect(count).toBe(2);
      expect(prisma.hotelManager.findMany).toHaveBeenCalledWith({
        where: { hotelId: mockHotelId },
        select: { userId: true },
      });
      expect(prisma.notification.create).toHaveBeenCalledTimes(2);
    });

    it('returns 0 when no managers are assigned to the hotel', async () => {
      prisma.hotelManager.findMany.mockResolvedValue([]);

      const count = await service.createForManagersOfHotel(mockHotelId, {
        type: NotificationType.BOOKING_CREATED,
        title: 'New Booking Created',
        message: 'A new reservation has been placed.',
      });

      expect(count).toBe(0);
      expect(prisma.notification.create).not.toHaveBeenCalled();
    });
  });

  describe('getUserNotifications()', () => {
    it('returns paginated notifications with meta and unread count', async () => {
      prisma.notification.count
        .mockResolvedValueOnce(1) // total
        .mockResolvedValueOnce(1); // unreadCount
      prisma.notification.findMany.mockResolvedValue([mockNotificationRecord]);

      const result = await service.getUserNotifications(mockUserId, {
        page: 1,
        limit: 20,
        sortBy: 'newest',
      });

      expect(result.items).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.unreadCount).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.totalPages).toBe(1);
      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: mockUserId },
          orderBy: { createdAt: 'desc' },
          skip: 0,
          take: 20,
        }),
      );
    });

    it('filters by isRead when provided', async () => {
      prisma.notification.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);
      prisma.notification.findMany.mockResolvedValue([]);

      await service.getUserNotifications(mockUserId, {
        page: 1,
        limit: 10,
        isRead: false,
      });

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: mockUserId, isRead: false },
        }),
      );
    });
  });

  describe('getUnreadCount()', () => {
    it('returns accurate count of unread notifications', async () => {
      prisma.notification.count.mockResolvedValue(5);

      const result = await service.getUnreadCount(mockUserId);
      expect(result.count).toBe(5);
      expect(prisma.notification.count).toHaveBeenCalledWith({
        where: { userId: mockUserId, isRead: false },
      });
    });
  });

  describe('getNotificationById()', () => {
    it('returns notification when owned by requesting user', async () => {
      prisma.notification.findUnique.mockResolvedValue(mockNotificationRecord);

      const result = await service.getNotificationById(
        mockUserId,
        mockNotificationId,
      );

      expect(result).toBeDefined();
      expect(result.id).toBe(mockNotificationId);
    });

    it('throws 404 when notification does not exist', async () => {
      prisma.notification.findUnique.mockResolvedValue(null);

      await expect(
        service.getNotificationById(mockUserId, 'invalid-id'),
      ).rejects.toMatchObject({
        code: 'NOTIFICATION_NOT_FOUND',
        status: HttpStatus.NOT_FOUND,
      });
    });

    it('throws 404 when notification belongs to another user (IDOR Defense)', async () => {
      prisma.notification.findUnique.mockResolvedValue({
        ...mockNotificationRecord,
        userId: mockOtherUserId,
      });

      await expect(
        service.getNotificationById(mockUserId, mockNotificationId),
      ).rejects.toMatchObject({
        code: 'NOTIFICATION_NOT_FOUND',
        status: HttpStatus.NOT_FOUND,
      });
    });
  });

  describe('markAsRead()', () => {
    it('updates unread notification to read with timestamp', async () => {
      prisma.notification.findUnique.mockResolvedValue(mockNotificationRecord);
      const readDate = new Date('2026-10-01T12:05:00.000Z');
      prisma.notification.update.mockResolvedValue({
        ...mockNotificationRecord,
        isRead: true,
        readAt: readDate,
      });

      const result = await service.markAsRead(mockUserId, mockNotificationId);

      expect(result.isRead).toBe(true);
      expect(result.readAt).toBe(readDate.toISOString());
      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: mockNotificationId },
        data: {
          isRead: true,
          readAt: expect.any(Date),
        },
      });
    });

    it('is idempotent: returns already-read notification without modifying', async () => {
      const readNotification = {
        ...mockNotificationRecord,
        isRead: true,
        readAt: new Date('2026-10-01T12:00:00.000Z'),
      };
      prisma.notification.findUnique.mockResolvedValue(readNotification);

      const result = await service.markAsRead(mockUserId, mockNotificationId);

      expect(result.isRead).toBe(true);
      expect(prisma.notification.update).not.toHaveBeenCalled();
    });

    it('throws 404 when marking another user notification as read', async () => {
      prisma.notification.findUnique.mockResolvedValue({
        ...mockNotificationRecord,
        userId: mockOtherUserId,
      });

      await expect(
        service.markAsRead(mockUserId, mockNotificationId),
      ).rejects.toMatchObject({
        code: 'NOTIFICATION_NOT_FOUND',
        status: HttpStatus.NOT_FOUND,
      });
    });
  });

  describe('markAllAsRead()', () => {
    it('marks all unread notifications as read for the user', async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 4 });

      const result = await service.markAllAsRead(mockUserId);

      expect(result.success).toBe(true);
      expect(result.count).toBe(4);
      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: {
          userId: mockUserId,
          isRead: false,
        },
        data: {
          isRead: true,
          readAt: expect.any(Date),
        },
      });
    });
  });
});
