# Realtime Events Architecture (Server-Sent Events)

## 1. Overview & Core Philosophy

Stayora uses **Server-Sent Events (SSE)** for unidirectional real-time updates from the NestJS backend to connected client applications (Customer Web App, Manager Web App, Admin Dashboard).

### Critical Architecture Rules

1. **PostgreSQL is the Sole Source of Truth**: SSE is strictly a transport notification mechanism. Authoritative business state is never stored in memory or in event queues.
2. **REST Remains Authoritative**: SSE informs clients that something changed; clients must always be able to recover complete state by querying standard REST endpoints (`GET /api/v1/bookings/:id`, `GET /api/v1/notifications`, etc.).
3. **Strict Post-Commit Event Emission**: Events are **never** emitted prior to database transaction commitment. If a transaction aborts or rolls back, zero events are emitted to connected clients.
4. **No Business Logic in SSE**: SSE never triggers bookings, payments, or status transitions. Business logic remains encapsulated in domain services.
5. **No WebSockets / Kafka / Distributed Brokers (Phase 15 Scope)**: Single-instance in-memory connection registry is used; distributed brokers are intentionally deferred.

---

## 2. Event Delivery Pipeline

```text
                     ┌────────────────────┐
                     │    PostgreSQL      │
                     │  Source of Truth   │
                     └─────────┬──────────┘
                               │
                        Business Service
                               │
                         DB Transaction
                               │
                             COMMIT
                               │
                               ▼
                       Domain/Application
                            Event
                               │
                               ▼
                      RealtimeService
                               │
                    ┌──────────┴──────────┐
                    │                     │
              Customer Routing       Manager Routing
                    │                     │
                    └──────────┬──────────┘
                               │
                               ▼
                         SSE Connections
                               │
                ┌──────────────┼──────────────┐
                ▼              ▼              ▼
           Customer       Manager          Admin
```

---

## 3. SSE Stream Endpoint

* **Route**: `GET /api/v1/events/stream`
* **Protocol**: HTTP/1.1 or HTTP/2 Server-Sent Events
* **Content-Type**: `text/event-stream`
* **Cache-Control**: `no-cache`
* **Connection**: `keep-alive`

### Authentication

The SSE endpoint requires valid authentication. Anonymous requests are rejected with `401 Unauthorized`. Two authentication mechanisms are supported:

1. **Standard Header**: `Authorization: Bearer <jwt-token>`
2. **Query Parameter**: `GET /api/v1/events/stream?token=<jwt-token>` (accommodates standard browser `EventSource` which cannot send custom HTTP headers).

The server decodes the JWT to resolve `userId`, `role`, and permissions. Client-supplied query parameters like `?userId=...` or `?role=...` are ignored.

---

## 4. Event Envelope & Catalog

### Standard Event Envelope

Every SSE event conforms to the following structure:

```json
{
  "id": "evt_01HXYZ...",
  "type": "BOOKING_CONFIRMED",
  "timestamp": "2026-10-02T12:00:00.000Z",
  "data": {
    "bookingId": "uuid-here",
    "status": "CONFIRMED"
  }
}
```

Format on the wire:
```text
id: evt_b84260aa-0e86-4da9-bfca-8bdf4529ec97
event: BOOKING_CONFIRMED
data: {"id":"evt_b84260aa-0e86-4da9-bfca-8bdf4529ec97","type":"BOOKING_CONFIRMED","timestamp":"2026-10-02T10:00:00.000Z","data":{"bookingId":"...","status":"CONFIRMED"}}
retry: 5000

```

### Event Catalog (`RealtimeEventType`)

| Event Type | Intended Recipients | Trigger |
| :--- | :--- | :--- |
| `BOOKING_CREATED` | Customer, Hotel Managers, Admins | Room reserved, status `PENDING` |
| `BOOKING_CONFIRMED` | Customer, Hotel Managers, Admins | Payment captured, booking active |
| `BOOKING_CANCELLED` | Customer, Hotel Managers, Admins | Cancellation committed |
| `PAYMENT_COMPLETED` | Customer, Hotel Managers, Admins | Payment successful |
| `PAYMENT_FAILED` | Customer, Admins | Payment attempt failed |
| `CHECKED_IN` | Customer, Hotel Managers | Guest checked in |
| `CHECKED_OUT` | Customer, Hotel Managers | Guest checked out |
| `NOTIFICATION_CREATED` | Targeted Customer/User | Notification stored in database |
| `HEARTBEAT` | All Connected Clients | Keep-alive heartbeat |

---

## 5. Authorization & Tenant Isolation

### Customer Scoping
Customers receive events that belong **strictly** to their authenticated account (`userId`). Customer A never receives events for Customer B (guaranteed by explicit user recipient targeting in `RealtimeService`).

### Manager Property Scoping
Managers receive real-time operational updates only for properties assigned to them in the database (`HotelManager` mapping).
* When a booking or stay event occurs for Hotel A, `RealtimeService` queries `HotelAuthorizationService.getAssignedManagerIds(hotelId)` and emits events solely to managers mapped to Hotel A.
* Managers assigned only to Hotel B receive nothing.

### Admin Policy Allowlist
Admins receive selected operational events defined in `ADMIN_ALLOWED_EVENT_TYPES`:
```ts
[
  RealtimeEventType.BOOKING_CREATED,
  RealtimeEventType.BOOKING_CONFIRMED,
  RealtimeEventType.BOOKING_CANCELLED,
  RealtimeEventType.PAYMENT_COMPLETED,
  RealtimeEventType.PAYMENT_FAILED,
]
```
High-frequency or non-operational events are excluded to prevent notification fatigue.

---

## 6. Connection Lifecycle & Management

### Multi-Connection Registry
Users may connect across multiple tabs or devices simultaneously.
`RealtimeService` maintains an in-memory mapping:
```text
userId → Map<connectionId, Subject<MessageEvent>>
```

* **Connection Limits**: Default limit `SSE_MAX_CONNECTIONS_PER_USER=5`. If a user attempts a 6th connection, the oldest connection is closed gracefully (`complete()`) and evicted before registering the new connection.
* **Disconnect Cleanup**: When a client terminates the connection, the RxJS observable cleanup hook (`finalize`) removes the connection ID. If no active connections remain for that `userId`, the user entry is removed entirely, preventing memory leaks.
* **Graceful Shutdown**: Implements `OnApplicationShutdown`. On server termination (`SIGTERM`/`SIGINT`), all active subscriptions receive `complete()`, heartbeat timers are cancelled, and the in-memory registry is cleared.

### Heartbeats & Keep-Alive
* Configured by `SSE_HEARTBEAT_INTERVAL_MS` (default: 30,000 ms).
* Periodic `: heartbeat` SSE comments/events are pushed to all active streams to prevent proxies, ALBs, or NAT gateways from dropping idle connections.
* Timer uses `unref()` so background timers never block Node.js process exits.

---

## 7. Recovery Model & Reconnection

```text
Initial Page Load
       ↓
REST API (authoritative state)

Real-Time Updates
       ↓
SSE Stream (/api/v1/events/stream)

Connection Lost
       ↓
Client Reconnects (SSE retry: 5000ms)

Missed Events
       ↓
REST Refetch (GET /api/v1/...)
       ↓
State Resynchronized
```

### Last-Event-ID Behavior
Every event includes a unique event ID (`id: evt_<uuid>`). In the browser, upon reconnecting, `EventSource` automatically sends the `Last-Event-ID` header.

**Important**: In Phase 15, event replay is **intentionally not supported**. The backend does not maintain an unbounded in-memory replay buffer or historical event store.
When a client reconnects after being offline, it must query the authoritative REST endpoints (`GET /api/v1/bookings`, `GET /api/v1/notifications`) to reconcile its local state.

---

## 8. Multi-Instance Limitation & Future Scale

> **Architectural Note**:
> The current SSE implementation is **single-instance aware**. An in-memory connection registry is maintained within the running NestJS process. In a horizontally scaled cluster:
> * Client connected to Instance A
> * State change committed on Instance B
> * Real-time event published on Instance B will not reach Client on Instance A without a shared event broker.
>
> Multi-instance fan-out requires a distributed message transport (such as Redis Pub/Sub, Redis Streams, or Kafka) and is intentionally deferred to a future clustering phase.

---

## 9. Security & Data Protection

1. **Payload Minimization**: Events contain only IDs, status values, and minimal timestamps (e.g., `{ bookingId, status, paymentId }`).
2. **Zero Sensitive Payment Data**: Credit card numbers, CVVs, tokens, and payment provider credentials are never included in event payloads.
3. **No IDOR**: Recipient resolution occurs strictly server-side using database authorization checks.
