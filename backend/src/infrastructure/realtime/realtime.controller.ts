import {
  Controller,
  Sse,
  UseGuards,
  MessageEvent,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../modules/auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../modules/auth/types/authenticated-user.type';
import { RealtimeService } from './realtime.service';

@ApiTags('Realtime / SSE')
@Controller('events')
export class RealtimeController {
  constructor(private readonly realtimeService: RealtimeService) {}

  /**
   * Establishes a persistent Server-Sent Events (SSE) connection.
   *
   * Authenticated via JWT (either Bearer header or ?token= query parameter for EventSource).
   * Stream emits real-time domain events scoped to the authenticated user's role and tenant boundaries:
   * - Customers: Own booking, payment, and notification updates.
   * - Managers: Operational events for assigned hotel properties.
   * - Admins: System operational event stream (subject to allowlist).
   *
   * Periodic heartbeats are sent every 30 seconds to maintain connection health across proxies.
   */
  @Sse('stream')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Establish Server-Sent Events (SSE) real-time stream',
    description:
      'Opens an HTTP connection with Content-Type: text/event-stream. Delivers real-time booking, payment, and notification events.',
  })
  @ApiQuery({
    name: 'token',
    required: false,
    description: 'JWT bearer token for environments where EventSource does not support custom headers',
  })
  @ApiResponse({
    status: 200,
    description: 'SSE stream established. Format: text/event-stream',
    content: {
      'text/event-stream': {
        schema: {
          type: 'string',
          example: 'id: evt_123\nevent: BOOKING_CONFIRMED\ndata: {"bookingId":"..."}\n\n',
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid JWT credentials',
  })
  streamEvents(
    @CurrentUser() user: AuthenticatedUser,
  ): Observable<MessageEvent> {
    const { stream } = this.realtimeService.registerConnection(user);
    return stream;
  }
}
