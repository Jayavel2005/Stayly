import { Observable, Subject } from 'rxjs';
import { MessageEvent } from '@nestjs/common';
import { RealtimeEventType } from './realtime.events';
import { UserRole } from '../../modules/auth/types/user-role.enum';

/**
 * Standardized Event Envelope sent over SSE stream.
 * Minimal payload without sensitive secrets.
 */
export interface RealtimeEnvelope<T = Record<string, unknown>> {
  id: string;
  type: RealtimeEventType;
  timestamp: string;
  data: T;
}

/**
 * Targeted Dispatch Options for Realtime Event Publishing.
 */
export interface PublishOptions {
  /**
   * Specific recipient user ID (Customer, Manager, or Admin).
   */
  userId?: string;

  /**
   * List of specific recipient user IDs.
   */
  userIds?: string[];

  /**
   * Property Hotel ID for routing operational updates to assigned hotel managers.
   */
  hotelId?: string;

  /**
   * Broadcast exclusively to active Administrator connections (subject to allowlist).
   */
  adminOnly?: boolean;

  /**
   * In addition to primary recipients, broadcast a copy to active Administrator connections.
   */
  includeAdmins?: boolean;
}

/**
 * In-memory client connection record.
 */
export interface ClientConnection {
  id: string;
  userId: string;
  role: UserRole | string;
  subject: Subject<MessageEvent>;
  connectedAt: Date;
  lastHeartbeatAt: Date;
}

/**
 * Result of registering a new SSE connection stream.
 */
export interface RegisterConnectionResult {
  connectionId: string;
  stream: Observable<MessageEvent>;
}
