import { NotificationType } from '../types/notification-type.enum';

export interface CreateNotificationPayload {
  userId: string;
  type: NotificationType | string;
  title: string;
  message: string;
  data?: Record<string, any> | null;
}
