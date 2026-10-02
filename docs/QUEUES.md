# Stayora Background Jobs & Asynchronous Processing (BullMQ)

> **Version:** 1.0.0 (Phase 14: BullMQ Background Jobs)  
> **Queue Engine:** BullMQ 5.x on Redis 7  
> **Database:** PostgreSQL 16 (Authoritative Source of Truth)  
> **Processing Paradigm:** At-Least-Once Delivery with Multi-Tier Idempotency  

---

## 1. Architectural Principles

### 1.1 PostgreSQL Remains the Sole Authoritative Source of Truth
* All core business operations (booking reservations, room holds, room availability, payment state transitions, cancellations, check-ins, refunds) are executed synchronously within PostgreSQL ACID transactions.
* BullMQ and Redis are non-authoritative supporting infrastructure. If Redis or BullMQ fails, core business transactions are not rolled back and data integrity is not compromised.
* Background workers never invent or mutate critical state without delegating to PostgreSQL-backed domain services (`BookingLifecycleService`, `NotificationsService`, etc.).

### 1.2 Separation of Concerns: Critical Path vs. Asynchronous Secondary Work
```text
HTTP Request (e.g., POST /bookings)
        │
        ▼
PostgreSQL Transaction (Pessimistic Hold & GiST Exclusion Check)
        │
        ▼ (Commit Success)
HTTP 201 Response to Client
        │
        ▼ (Post-Commit Domain Operation)
Enqueue BullMQ Job (Secondary Work)
        │
        ▼
BullMQ Worker (Worker Process)
        │
        ▼
PostgreSQL (Persist Notification / Fan-Out)
```

Secondary asynchronous tasks handled by BullMQ:
1. **In-app notification creation & delivery**
2. **Notification fan-out to hotel managers**
3. **Scheduled operational maintenance (cleanup of stale pending bookings)**
4. **Future extensions (email dispatch, push notifications, webhooks)**

---

## 2. Queue Configuration & Naming

Queue names and configurations are strictly centralized in `src/infrastructure/queues/queue.constants.ts`.

### 2.1 Centralized Queues
| Queue Name | Constant | Concurrency | Primary Responsibility |
| :--- | :--- | :---: | :--- |
| `notifications` | `QUEUE_NAMES.NOTIFICATIONS` | `5` | In-app notification creation & manager fan-out |
| `cleanup` | `QUEUE_NAMES.CLEANUP` | `1` | Operational scheduled sweeps (expired bookings) |

### 2.2 Redis Key Isolation
All BullMQ internal queues and keys share the centralized environment-aware prefix:
```text
stayora:{environment}:bull:{queueName}
```
For example, in development: `stayora:development:bull:notifications`.

---

## 3. Job Types & Strong Typing

Job names are defined as TypeScript enums and payloads are strongly typed in `src/infrastructure/queues/queue.types.ts`.

### 3.1 Job Names
```typescript
export enum NotificationJobName {
  SEND_NOTIFICATION = 'send-notification',
  FANOUT_HOTEL_MANAGERS = 'fanout-hotel-managers',
}

export enum CleanupJobName {
  EXPIRED_BOOKINGS = 'cleanup-expired-bookings',
}
```

### 3.2 Typed Payloads
```typescript
export interface SendNotificationJobPayload {
  userId: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown> | null;
  idempotencyKey?: string;
  eventId?: string;
}

export interface FanoutHotelManagersJobPayload {
  hotelId: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown> | null;
  idempotencyKey?: string;
  eventId?: string;
}

export interface CleanupExpiredBookingsJobPayload {
  triggeredAt?: string;
  scheduled?: boolean;
}
```
*Note: Sensitive information (passwords, JWTs, card numbers, payment secrets) is strictly prohibited in job payloads.*

---

## 4. Multi-Tier Idempotency Strategy

BullMQ guarantees **at-least-once delivery**. A job may be processed more than once during network partitions, worker crashes, or delayed acknowledgments. Stayora enforces idempotency at two distinct levels:

### 4.1 Tier 1: Queue-Level Deduplication
When enqueuing notification jobs, `QueueService` derives a deterministic, sanitized `jobId`:
```text
notif-{userId}-{type}-{idempotencyKey}
```
BullMQ rejects or ignores duplicate jobs enqueued while a job with the same ID is in `waiting`, `active`, or `delayed` status.

### 4.2 Tier 2: Database-Level Idempotency (Authoritative)
Before inserting a notification record into PostgreSQL, `NotificationProcessor` queries PostgreSQL using JSON filtering on the notification metadata:
```typescript
const existing = await this.prisma.notification.findFirst({
  where: {
    userId,
    metadata: {
      path: ['idempotencyKey'],
      equals: idempotencyKey,
    },
  },
});
if (existing) {
  this.logger.log(`Duplicate notification suppressed: ${idempotencyKey}`);
  return;
}
```
This guarantees that even if a job runs concurrently on multiple workers or retries after a partial timeout, exactly one business notification is persisted in PostgreSQL.

---

## 5. Retry Strategy & Error Classification

### 5.1 Retry Policy
Jobs default to:
* **Attempts:** 3
* **Backoff Strategy:** Exponential backoff starting at 1000ms (`delay = 1000 * 2^(attempt - 1)`):
  * Attempt 1: Immediate execution
  * Attempt 2: ~1,000ms delay
  * Attempt 3: ~2,000ms delay

### 5.2 Retryable vs. Non-Retryable Errors
* **Retryable Errors:** Transient infrastructure faults such as temporary database network disconnections or brief Redis timeouts. These throw standard errors causing BullMQ to reschedule the job.
* **Non-Retryable (Unrecoverable) Errors:** Missing mandatory fields (e.g. missing `userId` or invalid payload format). These throw `UnrecoverableError` (BullMQ built-in), immediately moving the job to `failed` status without wasting retry attempts:
```typescript
if (!userId || !type || !title || !message) {
  throw new UnrecoverableError('Invalid notification job payload: userId, type, title, and message are required.');
}
```

### 5.3 Dead-Letter & Job History Retention
To prevent Redis memory exhaustion, completed and failed jobs are pruned automatically using BullMQ retention policies:
```typescript
removeOnComplete: {
  count: 500, // Keep last 500 completed jobs for audit
  age: 3600,  // Remove after 1 hour
},
removeOnFail: {
  count: 1000, // Keep last 1,000 failed jobs for debugging
  age: 86400,  // Remove after 24 hours
}
```

---

## 6. Scheduled Cleanup Operations

### 6.1 Expired Booking Cleanup
* **Queue:** `cleanup`
* **Schedule:** Repeatable job scheduled via `upsertJobScheduler` to trigger every 60 seconds (`QUEUE_OPTIONS.CLEANUP_INTERVAL_MS`).
* **Concurrency:** `1` (prevents overlapping sweep cycles across multiple instances).
* **Execution Flow:**
```text
BullMQ Scheduled Trigger (every 60s)
        │
        ▼
CleanupProcessor
        │
        ▼
BookingLifecycleService.expireStalePendingBookings()
        │
        ▼
PostgreSQL Query:
  SELECT * FROM "Booking"
  WHERE status = 'PENDING'
    AND "holdExpiresAt" < NOW()
        │
        ▼
Authoritative State Machine Transition:
  PENDING ──> EXPIRED
  (Releases room holds and records AUDIT_LOG atomically)
```
* **PostgreSQL Authority:** Redis never tracks expiration times. PostgreSQL evaluates `holdExpiresAt < NOW()`. If the worker is delayed or restarted, PostgreSQL remains 100% correct.

---

## 7. Graceful Shutdown & Concurrency

### 7.1 Worker Concurrency
* **`notifications`:** `concurrency = 5` allows parallel processing of notifications and manager fan-out without overwhelming PostgreSQL connection pools.
* **`cleanup`:** `concurrency = 1` ensures sequential execution of operational sweeps.

### 7.2 Graceful Shutdown Lifecycle
`QueueService`, `NotificationProcessor`, and `CleanupProcessor` implement NestJS `OnApplicationShutdown`:
```text
Application SIGTERM / SIGINT
        │
        ▼
1. Worker pauses and stops accepting new jobs from BullMQ
2. Active running jobs are given time to complete cleanly
3. BullMQ Worker connections are closed
4. BullMQ Queue producer connections are closed
5. PostgreSQL and Redis clients disconnect cleanly
```

---

## 8. Health Checks & Observability

### 8.1 Health Endpoint (`GET /api/v1/health`)
Extended to include BullMQ queue health alongside PostgreSQL and Redis:
```json
{
  "status": "ok",
  "timestamp": "2026-10-02T10:00:00.000Z",
  "services": {
    "database": "up",
    "redis": "up",
    "queues": "up"
  }
}
```
If Redis or queue connectivity fails, the API reports `status: "degraded"` with `services.queues: "down"`. Primary customer APIs remain operational.

### 8.2 Structured Logging
All queue events are logged with structured context:
* `[QueueService] Job queued: {queue} -> {jobName} [ID: {jobId}]`
* `[Worker] Job started: {jobName} [ID: {jobId}] (Attempt: {attempt})`
* `[Worker] Job completed: {jobName} [ID: {jobId}] in {duration}ms`
* `[Worker] Job failed: {jobName} [ID: {jobId}] Attempt {attempt}/{max}: {error}`

---

## 9. Delivery Limitations & Future Evolution

### 9.1 Transaction-to-Queue Reliability Trade-off
Currently, background jobs are enqueued immediately following a successful PostgreSQL transaction commit:
```text
PostgreSQL Commit (Success)
        │
        ▼
QueueService.enqueueNotification(...)
```
**Documented Limitation:** If the application process crashes or is killed by the OS immediately after the database transaction commits but before the BullMQ job is enqueued in Redis, the secondary notification job will not be dispatched.

### 9.2 Future Outbox Pattern & SSE Evolution (Phase 15+)
When transactional notification delivery is strictly required or real-time Server-Sent Events (SSE) are introduced:
1. An `OutboxEvent` table can be populated inside the same PostgreSQL transaction as the booking.
2. A lightweight background poller or CDC worker reads uncommitted outbox events and enqueues them into BullMQ.
3. Once BullMQ confirms receipt or the worker completes, the outbox record is marked `PROCESSED`.
4. Domain events can then fan out simultaneously to BullMQ background workers and the SSE client streaming gateway.
