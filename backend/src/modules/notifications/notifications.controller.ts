import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import {
  NotificationResponse,
  PaginatedNotificationsResponse,
  UnreadCountResponse,
} from './types/notification-response.type';
import { JwtAuthGuard, CurrentUser } from '../../common';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';

@ApiTags('Notifications')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({
    summary: 'List User Notifications',
    description:
      'Retrieves paginated notifications belonging to the authenticated user. ' +
      'Supports filtering by unread/read state and database-level sorting.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of user notifications.',
  })
  async getNotifications(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryNotificationsDto,
  ): Promise<PaginatedNotificationsResponse> {
    return this.notificationsService.getUserNotifications(user.id, query);
  }

  @Get('unread-count')
  @ApiOperation({
    summary: 'Get Unread Notification Count',
    description:
      'Returns the total count of unread notifications for the authenticated user.',
  })
  @ApiResponse({
    status: 200,
    description: 'Unread notification count.',
  })
  async getUnreadCount(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<UnreadCountResponse> {
    return this.notificationsService.getUnreadCount(user.id);
  }

  @Patch('read-all')
  @ApiOperation({
    summary: 'Mark All Notifications As Read',
    description:
      'Marks all unread notifications belonging to the authenticated user as read. ' +
      'Idempotent and safe across repeated calls.',
  })
  @ApiResponse({
    status: 200,
    description: 'All notifications marked as read.',
  })
  async markAllAsRead(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: boolean; count: number; message: string }> {
    return this.notificationsService.markAllAsRead(user.id);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get Single Notification',
    description:
      'Retrieves details for a specific notification. ' +
      'Strictly enforces customer/user ownership.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID of the notification',
    example: '8b9c1d2e-3f4a-5b6c-7d8e-9f0a1b2c3d4e',
  })
  @ApiResponse({
    status: 200,
    description: 'Notification details.',
  })
  @ApiResponse({
    status: 404,
    description: 'Notification not found or unauthorized.',
  })
  async getNotificationById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<NotificationResponse> {
    return this.notificationsService.getNotificationById(user.id, id);
  }

  @Patch(':id/read')
  @ApiOperation({
    summary: 'Mark Notification As Read',
    description:
      'Marks a single notification as read and records the timestamp. ' +
      'Idempotent for already-read notifications.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID of the notification',
    example: '8b9c1d2e-3f4a-5b6c-7d8e-9f0a1b2c3d4e',
  })
  @ApiResponse({
    status: 200,
    description: 'Notification marked as read.',
  })
  @ApiResponse({
    status: 404,
    description: 'Notification not found or unauthorized.',
  })
  async markAsRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<NotificationResponse> {
    return this.notificationsService.markAsRead(user.id, id);
  }
}
