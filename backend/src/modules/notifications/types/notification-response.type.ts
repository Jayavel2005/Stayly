import { NotificationType } from './notification-type.enum';

export interface NotificationResponse {
  id: string;
  userId: string;
  type: NotificationType | string;
  title: string;
  message: string;
  data: Record<string, any> | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface PaginatedNotificationsResponse {
  items: NotificationResponse[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    unreadCount: number;
  };
}

export interface UnreadCountResponse {
  count: number;
}
