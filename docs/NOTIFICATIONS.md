# Stayora Notifications System

> **Version:** 1.0.0 (Phase 14: BullMQ Asynchronous Notification Processing)  
> **Processing Engine:** BullMQ on Redis 7 (Async Worker Execution)  
> **Persistence:** PostgreSQL 16 `Notification` entity (Authoritative)  

---

## 1. Overview

The Stayora Notification system delivers real-time and historical in-app notifications to customers and hotel managers. 

In Phase 14, notification creation and manager fan-out have been decoupled from synchronous HTTP transaction lifecycles using BullMQ background queues.

```text
Core Domain Action (e.g. Booking Confirmed)
                 │
                 ▼
     PostgreSQL ACID Transaction
                 │
                 ▼ (Commit Success)
       HTTP Response (Success)
                 │
                 ▼ (Async Job)
     BullMQ `notifications` Queue
                 │
                 ▼
      NotificationProcessor
                 │
        ┌────────┴────────┐
        ▼                 ▼
Customer In-App     Manager Fan-Out
  Notification       Notifications
        │                 │
        ▼                 ▼
   PostgreSQL        PostgreSQL
```

---

## 2. Notification Types & Triggers

| Event Trigger | Recipient | Type | Description |
| :--- | :--- | :--- | :--- |
| `Booking Created` | Customer | `BOOKING_CREATED` | Confirms room hold created with expiration timestamp |
| `Booking Confirmed` | Customer | `BOOKING_CONFIRMED` | Confirms successful payment and reservation |
| `Booking Cancelled` | Customer | `BOOKING_CANCELLED` | Notifies customer of booking cancellation & refund status |
| `Manager Fan-Out` | Hotel Managers | `HOTEL_BOOKING_ALERT` | Alerts assigned hotel managers of new bookings or cancellations |
| `Review Submitted` | Hotel Managers | `HOTEL_REVIEW_ALERT` | Alerts managers when a verified guest publishes a review |
| `Hold Expired` | Customer | `BOOKING_EXPIRED` | Informs customer that reservation hold has expired |

---

## 3. Asynchronous Processing Architecture

### 3.1 Dispatching Notifications
Domain services (`BookingsService`, `PaymentsService`, `ReviewsService`) trigger notifications via `NotificationsService`:
```typescript
await this.notificationsService.createNotification({
  userId: customer.id,
  type: 'BOOKING_CONFIRMED',
  title: 'Booking Confirmed',
  message: 'Your reservation at Grand Palace is confirmed!',
  data: { bookingId: booking.id, hotelId: booking.hotelId },
  idempotencyKey: `booking-${booking.id}-confirmed`,
});
```

### 3.2 Queue-Level and Database-Level Deduplication
To guarantee at-least-once delivery without duplicate alerts:
1. **Deterministic Job IDs:** BullMQ rejects duplicate concurrent enqueues using `notif-{userId}-{type}-{idempotencyKey}`.
2. **PostgreSQL Metadata Query:** Before inserting into the `Notification` table, `NotificationProcessor` queries PostgreSQL for existing records matching `metadata.idempotencyKey`.

### 3.3 Manager Fan-Out
When an event affects a hotel property (e.g. new reservation), `fanoutHotelManagers` is enqueued:
1. The background worker queries `HotelManager` in PostgreSQL to retrieve all manager user IDs assigned to that hotel.
2. For each manager, a notification is created with an idempotency key scoped to that manager (`${idempotencyKey}-mgr-${manager.userId}`).

---

## 4. API Endpoints

All notification endpoints require customer or manager JWT authentication.

### 4.1 List User Notifications
```http
GET /api/v1/notifications?page=1&limit=20&unreadOnly=false
```
* **Query Parameters:**
  * `page` (optional, default: 1): Pagination page number.
  * `limit` (optional, default: 20): Items per page.
  * `unreadOnly` (optional, default: false): Filter by unread notifications.
* **Response (200 OK):**
```json
{
  "data": [
    {
      "id": "c1f7b0a0-0000-4000-8000-000000000001",
      "userId": "u1f7b0a0-0000-4000-8000-000000000001",
      "type": "BOOKING_CONFIRMED",
      "title": "Booking Confirmed",
      "message": "Your reservation at Grand Palace is confirmed!",
      "isRead": false,
      "metadata": {
        "bookingId": "b1f7b0a0-0000-4000-8000-000000000001",
        "hotelId": "h1f7b0a0-0000-4000-8000-000000000001",
        "idempotencyKey": "booking-b1f7b0a0-confirmed"
      },
      "createdAt": "2026-10-02T10:00:00.000Z"
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

### 4.2 Mark Single Notification as Read
```http
PATCH /api/v1/notifications/:id/read
```
* **Response (200 OK):** Returns updated notification entity with `isRead: true`.

### 4.3 Mark All User Notifications as Read
```http
POST /api/v1/notifications/mark-all-read
```
* **Response (200 OK):**
```json
{
  "updatedCount": 5
}
```

### 4.4 Get Unread Notification Count
```http
GET /api/v1/notifications/unread-count
```
* **Response (200 OK):**
```json
{
  "unreadCount": 3
}
```

---

## 5. Resilience & Fallback Behavior

* **Queue Unavailability:** If BullMQ or Redis is unreachable when enqueuing, `NotificationsService` logs a warning and falls back to direct synchronous database insertion (`createDirect`), ensuring alerts are never dropped during Redis maintenance.
* **Worker Retry Policy:** Notification worker retries transient database failures up to 3 times with exponential backoff.
* **Permanent Failures:** Payload validation errors throw `UnrecoverableError` to avoid retry loops on corrupted events.
