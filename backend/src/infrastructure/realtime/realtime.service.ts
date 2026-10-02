import {
  Injectable,
  Logger,
  OnModuleInit,
  OnApplicationShutdown,
  MessageEvent,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Subject, finalize } from 'rxjs';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../modules/auth/types/authenticated-user.type';
import { UserRole } from '../../modules/auth/types/user-role.enum';
import { RealtimeEventType } from './realtime.events';
import {
  REALTIME_CONFIG,
  ADMIN_ALLOWED_EVENT_TYPES,
} from './realtime.constants';
import {
  RealtimeEnvelope,
  PublishOptions,
  ClientConnection,
  RegisterConnectionResult,
} from './realtime.types';

@Injectable()
export class RealtimeService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(RealtimeService.name);

  /**
   * In-Memory Connection Registry:
   * Maps userId -> Set of active ClientConnection instances.
   * Single-instance aware.
   */
  private readonly connections = new Map<string, Set<ClientConnection>>();

  /**
   * Dedicated index for active administrator connections to prevent full table scans.
   */
  private readonly adminConnections = new Set<ClientConnection>();

  /**
   * Heartbeat timer to keep long-lived SSE connections active.
   */
  private heartbeatTimer?: NodeJS.Timeout;

  private readonly heartbeatIntervalMs: number;
  private readonly maxConnectionsPerUser: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.heartbeatIntervalMs =
      this.configService.get<number>('realtime.heartbeatIntervalMs') ||
      REALTIME_CONFIG.DEFAULT_HEARTBEAT_INTERVAL_MS;

    this.maxConnectionsPerUser =
      this.configService.get<number>('realtime.maxConnectionsPerUser') ||
      REALTIME_CONFIG.DEFAULT_MAX_CONNECTIONS_PER_USER;
  }

  onModuleInit(): void {
    this.startHeartbeat();
    this.logger.log(
      `RealtimeService initialized (Heartbeat: ${this.heartbeatIntervalMs}ms, MaxConns/User: ${this.maxConnectionsPerUser}).`,
    );
  }

  onApplicationShutdown(signal?: string): void {
    this.logger.log(
      `Closing all SSE connections on application shutdown (signal: ${signal})...`,
    );
    this.stopHeartbeat();

    // Gracefully complete all open streams
    for (const [userId, userConns] of this.connections.entries()) {
      for (const conn of userConns) {
        try {
          conn.subject.complete();
        } catch {
          // ignore already closed
        }
      }
      userConns.clear();
    }

    this.connections.clear();
    this.adminConnections.clear();
    this.logger.log('All SSE connections terminated cleanly.');
  }

  /**
   * Registers an authenticated client connection to the real-time event stream.
   * Enforces max-connections per user by closing the oldest connection if needed.
   */
  registerConnection(user: AuthenticatedUser): RegisterConnectionResult {
    let userConns = this.connections.get(user.id);
    if (!userConns) {
      userConns = new Set<ClientConnection>();
      this.connections.set(user.id, userConns);
    }

    // Enforce connection limits: close oldest if limit reached
    if (userConns.size >= this.maxConnectionsPerUser) {
      let oldest: ClientConnection | undefined;
      for (const conn of userConns) {
        if (!oldest || conn.connectedAt < oldest.connectedAt) {
          oldest = conn;
        }
      }

      if (oldest) {
        this.logger.warn(
          `[RealtimeService] User ${user.id} exceeded max connections (${this.maxConnectionsPerUser}). Evicting oldest connection ${oldest.id}.`,
        );
        try {
          oldest.subject.complete();
        } catch {
          // ignore
        }
        userConns.delete(oldest);
        this.adminConnections.delete(oldest);
      }
    }

    const connectionId = randomUUID();
    const subject = new Subject<MessageEvent>();

    const clientConnection: ClientConnection = {
      id: connectionId,
      userId: user.id,
      role: user.role,
      subject,
      connectedAt: new Date(),
      lastHeartbeatAt: new Date(),
    };

    userConns.add(clientConnection);

    if (user.role === UserRole.ADMIN) {
      this.adminConnections.add(clientConnection);
    }

    this.logger.log(
      `[RealtimeService] SSE client connected: User ${user.id} (${user.role}) [Conn: ${connectionId}]. Total user conns: ${userConns.size}.`,
    );

    // Emit initial handshake event so NestJS SseStream immediately commits HTTP 200 and headers
    subject.next({
      id: `conn_${connectionId}`,
      type: RealtimeEventType.HEARTBEAT,
      data: {
        id: `conn_${connectionId}`,
        type: RealtimeEventType.HEARTBEAT,
        timestamp: new Date().toISOString(),
        data: { connected: true, connectionId },
      },
      retry: REALTIME_CONFIG.DEFAULT_RETRY_MS,
    });

    // Return observable with teardown hook on client disconnect / cancel
    const stream = subject.asObservable().pipe(
      finalize(() => {
        this.removeConnection(user.id, connectionId);
      }),
    );

    return { connectionId, stream };
  }

  /**
   * Removes a connection from the in-memory registry when disconnected.
   * Automatically cleans up the user entry if no connections remain.
   */
  removeConnection(userId: string, connectionId: string): void {
    const userConns = this.connections.get(userId);
    if (!userConns) return;

    for (const conn of userConns) {
      if (conn.id === connectionId) {
        userConns.delete(conn);
        this.adminConnections.delete(conn);
        this.logger.log(
          `[RealtimeService] SSE client disconnected: User ${userId} [Conn: ${connectionId}]. Remaining user conns: ${userConns.size}.`,
        );
        break;
      }
    }

    if (userConns.size === 0) {
      this.connections.delete(userId);
    }
  }

  /**
   * Publishes a domain/application event to targeted connected SSE clients.
   * Isolation guarantees:
   * - Customers receive only their own events.
   * - Managers receive only events for properties assigned to them.
   * - Admins receive events permitted by the admin allowlist.
   */
  async publish<T = Record<string, unknown>>(
    type: RealtimeEventType,
    data: T,
    options: PublishOptions = {},
  ): Promise<number> {
    const eventId = `evt_${randomUUID()}`;
    const envelope: RealtimeEnvelope<T> = {
      id: eventId,
      type,
      timestamp: new Date().toISOString(),
      data,
    };

    const message: MessageEvent = {
      id: envelope.id,
      type: envelope.type,
      data: envelope,
      retry: REALTIME_CONFIG.DEFAULT_RETRY_MS,
    };

    const targetUserIds = new Set<string>();

    if (options.userId) {
      targetUserIds.add(options.userId);
    }

    if (options.userIds && options.userIds.length > 0) {
      for (const uid of options.userIds) {
        if (uid) targetUserIds.add(uid);
      }
    }

    // Resolve assigned hotel managers if hotelId is specified
    if (options.hotelId) {
      try {
        const managers = await this.prisma.hotelManager.findMany({
          where: { hotelId: options.hotelId },
          select: { userId: true },
        });

        for (const mgr of managers) {
          targetUserIds.add(mgr.userId);
        }
      } catch (err: any) {
        this.logger.error(
          `[RealtimeService] Failed to resolve hotel managers for hotel ${options.hotelId}: ${err.message}`,
        );
      }
    }

    let deliveredCount = 0;

    // 1. Deliver to targeted users (Customers, assigned Managers, or explicit Users)
    if (!options.adminOnly) {
      for (const uid of targetUserIds) {
        const conns = this.connections.get(uid);
        if (conns && conns.size > 0) {
          for (const conn of conns) {
            try {
              conn.subject.next(message);
              deliveredCount++;
            } catch (err: any) {
              this.logger.warn(
                `[RealtimeService] Failed to send event to user ${uid} connection ${conn.id}: ${err.message}`,
              );
            }
          }
        }
      }
    }

    // 2. Deliver to active Administrators if requested and permitted by allowlist
    if (
      (options.adminOnly || options.includeAdmins) &&
      ADMIN_ALLOWED_EVENT_TYPES.has(type)
    ) {
      for (const adminConn of this.adminConnections) {
        // Prevent duplicate delivery if admin is already in targetUserIds
        if (!options.adminOnly && targetUserIds.has(adminConn.userId)) {
          continue;
        }

        try {
          adminConn.subject.next(message);
          deliveredCount++;
        } catch (err: any) {
          this.logger.warn(
            `[RealtimeService] Failed to send event to admin connection ${adminConn.id}: ${err.message}`,
          );
        }
      }
    }

    this.logger.log(
      `[RealtimeService] Published ${type} [ID: ${eventId}] to ${deliveredCount} active connection(s).`,
    );

    return deliveredCount;
  }

  /**
   * Starts periodic heartbeat emission to prevent HTTP stream timeout.
   */
  private startHeartbeat(): void {
    if (this.heartbeatTimer) return;

    this.heartbeatTimer = setInterval(() => {
      this.broadcastHeartbeat();
    }, this.heartbeatIntervalMs);

    // Unref timer so it does not block Node process exit during test suites
    if (this.heartbeatTimer.unref) {
      this.heartbeatTimer.unref();
    }
  }

  /**
   * Stops heartbeat timer.
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  /**
   * Broadcasts a lightweight heartbeat event to all connected clients.
   */
  private broadcastHeartbeat(): void {
    const heartbeatMessage: MessageEvent = {
      id: `hb_${Date.now()}`,
      type: RealtimeEventType.HEARTBEAT,
      data: {
        id: `hb_${Date.now()}`,
        type: RealtimeEventType.HEARTBEAT,
        timestamp: new Date().toISOString(),
        data: { ping: true },
      },
      retry: REALTIME_CONFIG.DEFAULT_RETRY_MS,
    };

    let count = 0;
    for (const userConns of this.connections.values()) {
      for (const conn of userConns) {
        try {
          conn.subject.next(heartbeatMessage);
          conn.lastHeartbeatAt = new Date();
          count++;
        } catch {
          // ignore closed
        }
      }
    }

    if (count > 0) {
      this.logger.debug(`[RealtimeService] Heartbeat sent to ${count} active SSE connection(s).`);
    }
  }

  // --- Observability & Diagnostic Helpers ---

  /**
   * Returns total count of active SSE client connections across all users.
   */
  getConnectionCount(): number {
    let total = 0;
    for (const conns of this.connections.values()) {
      total += conns.size;
    }
    return total;
  }

  /**
   * Returns count of active SSE connections for a specific user ID.
   */
  getUserConnectionCount(userId: string): number {
    return this.connections.get(userId)?.size ?? 0;
  }

  /**
   * Returns count of distinct active users with at least one active connection.
   */
  getActiveUserCount(): number {
    return this.connections.size;
  }

  /**
   * Returns count of active administrator connections.
   */
  getAdminConnectionCount(): number {
    return this.adminConnections.size;
  }
}
