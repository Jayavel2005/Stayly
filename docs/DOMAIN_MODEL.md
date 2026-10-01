# Stayora — Domain Model Specification: Hotel Management (Phase 5)

> **Phase 5 Technical Contract & Domain Model Reference**  
> **Authority:** NestJS Backend (`backend/src/modules/hotels`) & PostgreSQL Database  
> **Status:** Implemented & Verified  

---

## 1. Domain Overview

The **Hotel Management module** represents the foundational parent resource for the Stayora hospitality platform. The model establishes:

1. **Physical Property Registry (`hotels`)**: Represents physical hotel accommodations with geolocation, star rating, contact details, policies, and operational flags.
2. **Manager Property Assignments (`hotel_managers`)**: Decoupled, assignment-based many-to-many relationship linking hospitality managers (`User` with role `HOTEL_MANAGER`) to properties.
3. **Property Lifecycle States**: Active, inactive, and soft-deleted states ensuring referential stability for downstream room inventory, reservations, and financial audit logs.

```text
               ┌───────────────────────┐
               │         User          │
               │  role = HOTEL_MANAGER │
               └───────────┬───────────┘
                           │ 1
                           │
                           │ *
               ┌───────────▼───────────┐
               │     HotelManager      │
               │  (hotel_managers)     │
               │  assignedAt, role     │
               └───────────┬───────────┘
                           │ *
                           │
                           │ 1
               ┌───────────▼───────────┐
               │         Hotel         │
               │  (Physical Property)  │
               └───────────┬───────────┘
                           │ 1
                           │
        ┌──────────────────┼──────────────────┐
        │ *                │ *                │ *
┌───────▼────────┐ ┌───────▼────────┐ ┌───────▼────────┐
│    RoomType    │ │    Booking     │ │     Review     │
│   (Phase 6)    │ │   (Phase 8)    │ │   (Phase 10)   │
└────────────────┘ └────────────────┘ └────────────────┘
```

---

## 2. Core Entities & Relational Schema

### 2.1 Hotel (`hotels` Table)

| Field | Type | Modifiers / Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `@id`, `default(uuid())` | Surrogate primary key |
| `name` | `VARCHAR(150)` | `NOT NULL` | Display name of the hotel property |
| `slug` | `VARCHAR(180)` | `UNIQUE`, `NOT NULL` | SEO-friendly unique URL identifier |
| `description` | `TEXT` | `NULLABLE` | Comprehensive overview & amenities summary |
| `starRating` | `INT` | `default(0)`, check: 1–5 | Official hospitality star classification |
| `addressLine1` | `VARCHAR(255)` | `NOT NULL` | Street address |
| `addressLine2` | `VARCHAR(255)` | `NULLABLE` | Suite, landmark, or floor |
| `city` | `VARCHAR(100)` | `NOT NULL`, indexed | Municipal location for customer searches |
| `state` | `VARCHAR(100)` | `NOT NULL` | Regional province or state |
| `country` | `VARCHAR(100)` | `NOT NULL`, indexed | Country of operation |
| `postalCode` | `VARCHAR(20)` | `NOT NULL` | Postal / PIN code |
| `latitude` | `DECIMAL(10, 7)` | `NULLABLE` | GPS latitude |
| `longitude` | `DECIMAL(10, 7)` | `NULLABLE` | GPS longitude |
| `email` | `VARCHAR(255)` | `NOT NULL` | Front-desk contact email |
| `phone` | `VARCHAR(50)` | `NOT NULL` | Front-desk contact phone number |
| `checkInTime` | `TIMETZ` | `default("14:00")` | Standard property check-in schedule |
| `checkOutTime` | `TIMETZ` | `default("11:00")` | Standard property check-out schedule |
| `isActive` | `BOOLEAN` | `default(true)`, indexed | Operational visibility flag |
| `createdAt` | `TIMESTAMPTZ` | `default(now())` | Creation audit timestamp |
| `updatedAt` | `TIMESTAMPTZ` | `updatedAt` | Automatic update timestamp |
| `deletedAt` | `TIMESTAMPTZ` | `NULLABLE`, indexed | Soft-delete timestamp |

### 2.2 HotelManager (`hotel_managers` Table)

The relationship between `User` and `Hotel` is modeled explicitly as an associative entity rather than a scalar `hotel.managerId` foreign key.

| Field | Type | Modifiers / Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `@id`, `default(uuid())` | Primary key for the assignment record |
| `userId` | `UUID` | `NOT NULL`, FK $\to$ `users.id` | Reference to manager account |
| `hotelId` | `UUID` | `NOT NULL`, FK $\to$ `hotels.id` | Reference to managed hotel |
| `assignedAt` | `TIMESTAMPTZ` | `default(now())` | When the manager was assigned |
| `assignedBy` | `UUID` | `NULLABLE`, FK $\to$ `users.id` | Administrator who made the assignment |
| `role` | `VARCHAR(50)` | `default("GENERAL_MANAGER")` | Functional managerial designation |

#### Compound Key Invariant:
```prisma
@@unique([userId, hotelId], name: "userId_hotelId")
```
A manager can only be assigned to a specific hotel once. However, a manager can be assigned to multiple distinct hotels, and a hotel can have multiple assigned managers.

---

## 3. Hotel Ownership & Assignment Architecture

### 3.1 Design Justification for Assignment Model
Rather than a naive `hotel.managerId` column:
1. **Multi-Manager Support:** Large properties require multiple operational managers (General Manager, Front Office Manager, Inventory Manager).
2. **Reassignment Without Data Loss:** Managers can be unassigned, replaced, or added without mutating the underlying physical hotel entity.
3. **Audit Trail:** The `assignedAt` and `assignedBy` attributes record when and by whom administrative authority was delegated.

### 3.2 Authorization Enforcement
The backend enforces that managers only operate on properties to which they are actively linked:

```text
Request: PATCH /api/v1/manager/hotels/44444444-...
Caller: JWT with sub: 22222222-... (role: HOTEL_MANAGER)

Database Query:
  SELECT 1 FROM hotel_managers
  WHERE user_id = '22222222-...' AND hotel_id = '44444444-...'
  LIMIT 1;

Result:
  - If FOUND: Proceed with update.
  - If NOT FOUND: Throw 403 Forbidden (or 404 under strict privacy policy).
```

---

## 4. Administrative Permissions & Assignment Workflows

Only users with the `ADMIN` role are authorized to:
1. **Create Properties (`POST /api/v1/admin/hotels`)**: Instantiate new hotel records in the platform directory.
2. **Assign Managers (`POST /api/v1/admin/hotels/:id/managers`)**: Bind verified managers to specific properties.
3. **Unassign Managers (`DELETE /api/v1/admin/hotels/:id/managers/:managerId`)**: Revoke management access.
4. **Platform Auditing (`GET /api/v1/admin/hotels`)**: View all properties, including deactivated or soft-deleted hotels, along with assigned manager metadata.

Managers **cannot** assign themselves or other users to properties. Clients cannot pass `managerId` or `assignedAt` in property creation or update payloads.

---

## 5. Lifecycle & Deactivation Strategy

### 5.1 Soft-Deletion & Inactivation
Physical deletion (`DELETE FROM hotels WHERE id = ...`) is prohibited for active operations because hotels serve as the parent entity for room types, rooms, reservations, payments, and guest reviews. Deleting a hotel would either:
- Violate foreign key constraints (`RESTRICT`), or
- Irresponsibly purge historical accounting and guest reservation records (`CASCADE`).

### 5.2 Lifecycle States
1. **Active (`isActive: true, deletedAt: null`)**:
   - Fully visible in customer search and public discovery.
   - Eligible for room reservations and manager updates.
2. **Inactive (`isActive: false, deletedAt: null`)**:
   - Temporarily offline (e.g., seasonal closure or maintenance).
   - Hidden from public customer search.
   - Remains accessible to assigned managers and administrators.
3. **Soft-Deleted (`isActive: false, deletedAt: <timestamp>`)**:
   - Marked as permanently discontinued.
   - Omitted from all public queries and manager operations.
   - Preserved in PostgreSQL for historical reference and administrative audit.

---

## 6. Public vs Protected Endpoints

| Domain | Route | HTTP | Auth Required | Role | Description |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **Public** | `/hotels` | `GET` | No | Any | Search & filter active hotels |
| **Public** | `/hotels/:id` | `GET` | No | Any | Retrieve active hotel details |
| **Customer** | `/customer/hotels` | `GET` | Yes | `CUSTOMER` | Customer directory listing |
| **Manager** | `/manager/hotels` | `GET` | Yes | `HOTEL_MANAGER` | List assigned properties |
| **Manager** | `/manager/hotels/:id` | `GET` | Yes | `HOTEL_MANAGER` | Retrieve assigned property |
| **Manager** | `/manager/hotels/:id` | `PATCH` | Yes | `HOTEL_MANAGER` | Update assigned property |
| **Manager** | `/manager/hotels/:id` | `DELETE` | Yes | `HOTEL_MANAGER` | Soft-deactivate assigned property |
| **Admin** | `/admin/hotels` | `GET` | Yes | `ADMIN` | Global property audit |
| **Admin** | `/admin/hotels/:id` | `GET` | Yes | `ADMIN` | Global property detail |
| **Admin** | `/admin/hotels` | `POST` | Yes | `ADMIN` | Create new hotel property |
| **Admin** | `/admin/hotels/:id` | `PATCH` | Yes | `ADMIN` | System property update |
| **Admin** | `/admin/hotels/:id` | `DELETE` | Yes | `ADMIN` | Administrative soft-delete |
| **Admin** | `/admin/hotels/:id/managers` | `POST` | Yes | `ADMIN` | Assign manager to property |
| **Admin** | `/admin/hotels/:id/managers/:mgrId` | `DELETE` | Yes | `ADMIN` | Remove manager assignment |

---

## 7. Pagination, Sorting & Filtering

### 7.1 Database-Level Pagination
Pagination parameters are passed directly to PostgreSQL via Prisma:
```ts
const skip = (page - 1) * limit;
const take = limit;
```
Default `limit` is 20; maximum permitted limit is 100. Memory-level array slicing is strictly prohibited.

### 7.2 Safe Filters & Sorting
- **Filters:** `city`, `state`, `country`, `search` (name substring matching using PostgreSQL `mode: 'insensitive'`), `starRating`, and `minRating` (`gte: minRating`).
- **Sorting Whitelist:** `name`, `starRating`, `createdAt`, `city` with order `asc` or `desc`. Dynamic or unvalidated column injection is prevented via enum validation in `QueryHotelsDto`.

---

## 8. Room Categories (`room_types`) & Physical Inventory (`rooms`) (Phase 6)

### 8.1 The Domain Distinction: Product vs Unit
* **`RoomType` (Category / Product):** The sellable inventory archetype (e.g., Deluxe King, Presidential Suite). Customers search, compare, and reserve room categories. Attributes include capacity, pricing in integer cents (`base_price_cents`), bed configuration, and amenities.
* **`Room` (Physical Unit):** The actual brick-and-mortar hotel room (e.g., Room 101, Room 102A). Rooms belong to exactly one `RoomType` and one `Hotel`. Physical room identifiers are operational entities for front-desk and housekeeping, not public booking catalog entries.

```text
Hotel A (Mumbai)
├── Deluxe Room (RoomType) ────────── basePriceCents: 500000 (₹5,000.00)
│    ├── Room 101 (AVAILABLE)
│    ├── Room 102 (MAINTENANCE)
│    └── Room 103 (AVAILABLE)
└── Presidential Suite (RoomType) ── basePriceCents: 1500000 (₹15,000.00)
     ├── Room 201 (AVAILABLE)
     └── Room 202 (AVAILABLE)
```

### 8.2 Database Constraints & Integrity
1. **Uniqueness Invariants:**
   - `RoomType`: Unique by hotel and slug: `@@unique([hotelId, slug])`. Different hotels may feature categories with the same name.
   - `Room`: Unique by hotel and room number: `@@unique([hotelId, roomNumber])`. Different hotels may have a Room 101, but a single property cannot duplicate room numbers.
2. **Occupancy & Pricing Checks:**
   - `chk_room_types_occupancy`: `max_occupancy >= 1 AND max_adults >= 1 AND max_children >= 0`
   - `chk_room_types_pricing`: `base_price_cents >= 0` (Exact `BigInt` monetary representation in cents/paise; zero floating-point rounding errors).
3. **Operational Status vs Booking Availability:**
   - `operational_status`: `AVAILABLE`, `OCCUPIED`, `MAINTENANCE`, `OUT_OF_SERVICE`.
   - **Operational status** designates physical asset readiness (maintenance repairs, deep cleaning, decommissioned).
   - **Booking availability** is date-range-specific temporal availability calculated dynamically in later booking/inventory phases.

### 8.3 Referential Integrity & Deletion Protections
- `RoomType` cannot reference a non-existent `Hotel` (`onDelete: Restrict`).
- `Room` cannot reference a non-existent `RoomType` (`onDelete: Restrict`).
- Deleting a `RoomType` that still contains active physical rooms is blocked (`409 Conflict` - `ROOM_TYPE_HAS_ROOMS`).
- Soft-deletion sets `deletedAt = now()` and sets rooms to `OUT_OF_SERVICE`, preserving historical booking snapshots and audit logs.

---

## 9. Hotel Discovery & Date-Range Availability (Phase 7)

### 9.1 Temporal Date Semantics: `[checkIn, checkOut)`
Hotel reservations operate on **half-open date intervals**:
```text
[checkIn, checkOut)
```
- **`checkIn` (inclusive):** The guest occupies the room beginning in the afternoon of the check-in date.
- **`checkOut` (exclusive):** The guest vacates the room in the morning/noon of the check-out date.

**Contiguity Example:**
```text
Booking A:  2026-10-10 → 2026-10-12
Booking B:  2026-10-12 → 2026-10-15
```
Because check-out is exclusive, Booking A and Booking B **do not overlap**. Room 101 can be checked out on October 12th at 11:00 AM, cleaned by housekeeping, and checked in by a new guest at 2:00 PM on October 12th.

### 9.2 The Overlap Theorem
Two date ranges overlap if and only if:
```sql
existing.check_in_date < requested.check_out_date
AND
existing.check_out_date > requested.check_in_date
```
This bidirectional inequality correctly handles all containment, partial overlap, and identical interval scenarios, while correctly avoiding false collisions on back-to-back turnaround dates (`existing.check_out == requested.check_in`).

### 9.3 Authoritative Availability Equation
A room is not "available" in the abstract; it is available **for a specific date range**:
```text
Date-Available Room =
    Physical Room is operationally AVAILABLE
    +
    RoomType and Hotel are active and non-deleted
    +
    Room has NO conflicting, active allocation for requested [checkIn, checkOut)
```

**Conflicting Allocation Definition:**
A `BookingRoom` record is considered conflicting if:
1. `status IN ('RESERVED', 'OCCUPIED')`
2. Overlaps requested date range: `checkInDate < requestedCheckOut AND checkOutDate > requestedCheckIn`
3. Associated `Booking.status IN ('PENDING', 'CONFIRMED', 'CHECKED_IN')`
4. For temporary inventory holds (`Booking.status = 'PENDING'`), the hold has not expired (`holdExpiresAt IS NULL OR holdExpiresAt > NOW()`).

### 9.4 Database Query Strategy: `NOT EXISTS` Relational Filtering
Availability is evaluated inside PostgreSQL using relational filtering rather than loading all rooms into application memory:
```prisma
rooms: {
  some: {
    deletedAt: null,
    operationalStatus: 'AVAILABLE',
    bookingRooms: {
      none: {
        status: { in: ['RESERVED', 'OCCUPIED'] },
        checkInDate: { lt: checkOutDate },
        checkOutDate: { gt: checkInDate },
        booking: {
          status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] },
          OR: [
            { holdExpiresAt: null },
            { holdExpiresAt: { gt: new Date() } },
          ],
        },
      },
    },
  },
}
```
This maps directly to an indexed PostgreSQL `NOT EXISTS` subquery, avoiding $N+1$ queries.

### 9.5 Search vs. Reservation Architectural Boundary
- **Search (`Phase 7`):** Customer discovery read-path. Answers *"Which rooms are currently unoccupied for these dates?"* It does not mutate inventory or guarantee that inventory will remain vacant.
- **Booking Engine (`Phase 8`):** Customer reservation write-path. Must perform atomic availability checks and hold acquisition within a PostgreSQL transaction with explicit row-level locking (`FOR UPDATE`) or serializable isolation.

---

## 10. Reservations, Booking Engine & Concurrency (Phase 8)

### 10.1 The Booking Creation Transaction Pipeline
The booking engine safely converts a customer search intent into an authoritative reservation folio:
```text
BEGIN TRANSACTION
  ├── 1. Re-validate Hotel & RoomType active status
  ├── 2. Verify RoomType.hotelId === requestedHotelId
  ├── 3. Enforce guest capacity (RoomType.maxOccupancy >= guests)
  ├── 4. Lock candidate operational physical rooms:
  │      SELECT id, room_number FROM rooms
  │      WHERE room_type_id = $roomTypeId AND operational_status = 'AVAILABLE'
  │      ORDER BY room_number ASC FOR UPDATE
  ├── 5. Query conflicting overlapping allocations:
  │      SELECT room_id FROM booking_rooms
  │      WHERE room_id = ANY($candidateRoomIds)
  │        AND status IN ('RESERVED', 'OCCUPIED')
  │        AND check_in_date < $checkOutDate AND check_out_date > $checkInDate
  │        AND booking.status IN ('PENDING', 'CONFIRMED', 'CHECKED_IN')
  ├── 6. Verify sufficient available units (available >= requestedRooms); throw 409 if not
  ├── 7. Calculate exact gross, tax, and net amounts using integer cents (BigInt)
  ├── 8. Generate unique reference: STY-YYYYMM-XXXXXX
  ├── 9. Persist Booking (status: PENDING, holdExpiresAt: NOW() + 15m)
  ├── 10. Persist BookingRoom allocation records (status: RESERVED)
  └── 11. Persist BookingPriceSnapshot record (freezing rate historical data)
COMMIT
```

### 10.2 Concurrency & Double-Booking Protection
1. **Pessimistic Row-Level Locking:** Deterministic ordering (`ORDER BY room_number ASC FOR UPDATE`) prevents deadlocks and serializes concurrent allocation requests across identical room categories.
2. **PostgreSQL GiST Exclusion Constraint (`exclude_overlapping_room_allocations`):**
   ```sql
   EXCLUDE USING gist (
       "room_id" WITH =,
       daterange("check_in_date", "check_out_date", '[)') WITH &&
   )
   WHERE ("status" IN ('RESERVED', 'OCCUPIED'));
   ```
   Guarantees zero physical room double-booking at the storage engine level under all concurrent scenarios.

### 10.3 Historical Price Snapshotting
To insulate completed and in-flight reservations from subsequent hotel price increases or inflation, rates are frozen in `booking_price_snapshots`:
- `base_rate_cents`: RoomType rate at time of booking.
- `gross_room_cents`: `base_rate_cents * totalNights * roomsCount`.
- `net_amount_cents`: Total invoice folio payable.
- Zero floating-point drift (`BigInt` minor currency units / paise).

### 10.4 State Machine & Lifecycle Transitions
```text
PENDING (15m hold) ──► CONFIRMED (paid) ──► CHECKED_IN (arrival) ──► CHECKED_OUT (departure)
      │                       │
      ├──► CANCELLED          └──► CANCELLED
      └──► EXPIRED
```
- Active inventory holding states: `PENDING` (while `holdExpiresAt > NOW()`), `CONFIRMED`, `CHECKED_IN`.
- Terminal / released inventory states: `CANCELLED`, `CHECKED_OUT`, `EXPIRED`, `NO_SHOW`.

---

## 11. Payments & Payment Attempts Ledger (Phase 9)

### 11.1 Domain Architecture & Entity Separation
Stayora strictly maintains a decoupled multi-attempt ledger separating logical payments from gateway execution attempts:

```text
Customer
   │ (owns)
   ▼
Booking (status: PENDING ──► CONFIRMED)
   │ 1
   │ (1:1 logical relationship)
   ▼
Payment (status: PENDING ──► SUCCEEDED / FAILED)
   │ 1
   │ (1:N audit trail)
   ▼
PaymentAttempt (status: CREATED ──► PROCESSING ──► SUCCEEDED / FAILED)
   │
   ▼
PaymentGateway Abstraction
   │
   ▼
MockPaymentGateway (Deterministic testing simulator)
```

1. **`Payment` (Logical Record)**: Represents the authoritative payment contract associated with a `Booking`. Exactly one logical `Payment` record exists per booking (`booking_id` has a `UNIQUE` constraint).
2. **`PaymentAttempt` (Audit Log Unit)**: Represents an individual gateway submission. When an attempt fails (e.g., card declined), the attempt remains permanently recorded as `FAILED` in the immutable audit ledger. Subsequent retries create a new sequential `PaymentAttempt` (Attempt #2, Attempt #3) rather than overwriting historical attempts.
3. **`PaymentGateway` Interface**: Decouples domain logic from gateway-specific SDKs. All gateway operations return domain-level `GatewayPaymentResult` structs.
4. **`MockPaymentGateway`**: Deterministic test simulator supporting `SUCCESS`, `FAILED`, and configurable test reasons without random flakes or network delays.

### 11.2 Database Constraints & Integrity Invariants
* **`payments.booking_id UNIQUE`**: Enforces that a reservation can never have duplicate conflicting logical payments.
* **`payment_attempts.idempotency_key UNIQUE`**: Enforces strict database-level idempotency across all attempts.
* **`payment_attempts(payment_id, attempt_number) UNIQUE`**: Guarantees sequential, monotonic attempt numbering per payment.
* **`chk_payments_status`**: Enforces valid payment statuses: `PENDING`, `SUCCEEDED`, `FAILED`, `REFUNDED`, `PARTIALLY_REFUNDED`.
* **`chk_payment_attempts_status`**: Enforces attempt statuses: `CREATED`, `PROCESSING`, `SUCCEEDED`, `FAILED`.
* **`chk_payments_amount` & `chk_payment_attempts_amount`**: Enforces non-negative monetary amounts (`amount_cents >= 0`).

### 11.3 Idempotency Architecture & Scoping
* **Scope**: Idempotency keys are client-provided unique tokens scoped to the booking. If a client retries a request with the identical key for the same booking, the backend replays the exact previous outcome without duplicate attempts or charge operations.
* **Cross-Booking Defense**: Reusing an existing `Idempotency-Key` across different bookings is rejected with `409 CONFLICT` (`IDEMPOTENCY_KEY_REUSED`).
* **Concurrency Protection**: Simultaneous requests with identical keys are deduplicated under transactional row locks and database unique constraints (`P2002`). Simultaneous requests with different keys on the same booking are serialized via pessimistic locking (`SELECT ... FOR UPDATE`), ensuring exactly one attempt succeeds and the second fails with `PAYMENT_ALREADY_COMPLETED` (409).

### 11.4 Payment State Machine
```text
           ┌──────────────┐
           │   PENDING    │◄────────┐ (Retry with new attempt)
           └──────┬───────┘         │
                  │                 │
         ┌────────┴────────┐        │
         ▼                 ▼        │
   ┌───────────┐     ┌───────────┐  │
   │ SUCCEEDED │     │  FAILED   ├──┘
   └─────┬─────┘     └───────────┘
         │ (Terminal)
         ▼
   Booking: CONFIRMED
```

- When an attempt succeeds:
  - `PaymentAttempt` → `SUCCEEDED`
  - `Payment` → `SUCCEEDED` (`settledAt` populated)
  - `Booking` → `CONFIRMED`
- When an attempt fails:
  - `PaymentAttempt` → `FAILED` (`failureReason` populated)
  - `Payment` → `FAILED`
  - `Booking` remains `PENDING` (allowing retry before temporary reservation hold expires).

---

## 12. Booking Lifecycle State Machine & Cancellation (Phase 10)

### 12.1 Authoritative Booking State Machine

Stayora enforces a centralized, authoritative domain state machine implemented in `BookingLifecycleService`:

```text
                  ┌──────────────┐
                  │   PENDING    │
                  └──────┬───────┘
            ┌────────────┼────────────┐
            │            │            │
            ▼            ▼            ▼
      ┌───────────┐┌───────────┐┌───────────┐
      │ CONFIRMED ││ CANCELLED ││  EXPIRED  │
      └─────┬─────┘└───────────┘└───────────┘
      ┌─────┴─────┐
      │           │
      ▼           ▼
┌───────────┐┌───────────┐
│CHECKED_IN ││  NO_SHOW  │
└─────┬─────┘└───────────┘
      │
      ▼
┌───────────┐
│CHECKED_OUT│
└───────────┘
```

#### Valid Transitions
| Initial State | Target State | Trigger / Actor | Operational Rules |
| :--- | :--- | :--- | :--- |
| `PENDING` | `CONFIRMED` | Gateway / Manager / Admin | Payment `SUCCEEDED` or manual staff verification. |
| `PENDING` | `CANCELLED` | Customer / Manager / Admin | Customer cancels unpaid hold or staff operational release. |
| `PENDING` | `EXPIRED` | System / Cron Scheduler | Hold window (`holdExpiresAt < now`) elapsed. |
| `CONFIRMED` | `CHECKED_IN` | Assigned Manager / Admin | Guest arrival; marks room `OCCUPIED`. |
| `CONFIRMED` | `CANCELLED` | Customer / Assigned Manager / Admin | Customer cancellation; marks room `CANCELLED`. |
| `CONFIRMED` | `NO_SHOW` | Assigned Manager / Admin | Guest failed to arrive; marks room `RELEASED`. |
| `CHECKED_IN` | `CHECKED_OUT` | Assigned Manager / Admin | Guest departure; marks room `RELEASED`. |

#### Terminal States
`CHECKED_OUT`, `CANCELLED`, `EXPIRED`, and `NO_SHOW` are terminal states. No subsequent state transitions are permitted; invalid transitions reject with `400 BAD_REQUEST` (`INVALID_STATE_TRANSITION`).

### 12.2 Physical Room Inventory Semantics & Historical Preservation
* **Decoupling Operational Status from Booking Occupancy**: Physical rooms (`Room.operationalStatus`) represent physical readiness (`AVAILABLE`, `MAINTENANCE`, `OUT_OF_SERVICE`). Booking lifecycle actions **never** mutate `Room.operationalStatus`.
* **Allocation Status Lifecycle (`booking_rooms.status`)**:
  - `RESERVED`: Initial hold and confirmed state (`PENDING`, `CONFIRMED`). Blocks date-range availability.
  - `OCCUPIED`: Guest physically checked in (`CHECKED_IN`). Blocks date-range availability.
  - `RELEASED`: Guest checked out (`CHECKED_OUT`) or marked `NO_SHOW`. Allocation ceases to block future dates.
  - `CANCELLED`: Reservation cancelled or expired (`CANCELLED`, `EXPIRED`). Allocation ceases to block future dates.
* **Critical Invariant**:
  > **Cancelled and completed bookings are NEVER deleted from the database.**  
  > Historical allocations, price snapshots, and payment records remain permanently for accounting, reporting, and audit trails. Real-time availability queries simply filter out non-blocking statuses (`CANCELLED`, `RELEASED`, `EXPIRED`).

### 12.3 Cancellation Rules & Payment Invariants
* **Customer Ownership Enforcement (IDOR Defense)**: Customers may cancel only reservations where `booking.customerId === user.id`. Cross-customer cancellation attempts return `404 NOT_FOUND` to avoid resource existence disclosure.
* **Manager Isolation**: Hotel managers may cancel reservations only for properties explicitly assigned in `hotel_managers`.
* **State Check**: Once a guest has checked in (`CHECKED_IN`) or completed their stay (`CHECKED_OUT`), cancellation is prohibited (`BOOKING_NOT_CANCELLABLE` / `INVALID_STATE_TRANSITION`).
* **Payment Consistency & Deferred Refund Policy**:
  - Cancelling a paid booking transitions `Booking.status` to `CANCELLED`.
  - The associated `Payment` record remains strictly historically accurate with status `SUCCEEDED`.
  - **No Fake Refund Created**: Refund processing is explicitly deferred to a dedicated payment/refund phase. Money is not marked as refunded until real gateway settlement occurs.

### 12.4 Operational Check-In & Check-Out Rules
* **Check-In Authorization**: Restricted to assigned `HOTEL_MANAGER` or `ADMIN`. Customers receive `403 FORBIDDEN`.
* **Eligibility**: The reservation must be in `CONFIRMED` state. Unconfirmed (`PENDING`), cancelled, or expired reservations reject with `400 BOOKING_NOT_CHECKINABLE`.
* **Date Semantics**: Reservation dates use half-open interval `[checkInDate, checkOutDate)`. Check-in is allowed on or after `checkInDate`, but rejected if the scheduled checkout date has passed (`now >= checkOutDate`).
* **Check-Out**: Restricted to assigned `HOTEL_MANAGER` or `ADMIN`. The reservation must be in `CHECKED_IN` state. Transitions to `CHECKED_OUT`, marks allocations `RELEASED`, and timestamps `checkedOutAt`.

### 12.5 Hold Expiration & Background Integration
* `BookingLifecycleService.expireBooking(bookingId)` transitions eligible `PENDING` bookings to `EXPIRED` and marks allocated rooms `CANCELLED`.
* `BookingLifecycleService.expireStalePendingBookings()` scans for `holdExpiresAt < now` and bulk expires them.
* **Scheduled Task Integration Point**: Designed for scheduled execution (NestJS `@Cron` or BullMQ background workers in future phases) without introducing external infrastructure in Phase 10.

### 12.6 Concurrency Protection & Audit Ledger
* **Pessimistic Locking**: Every lifecycle transition locks the target booking row (`SELECT ... FOR UPDATE`) inside an atomic database transaction (`PrismaService.$transaction`).
* **Audit Trail**: Every lifecycle mutation automatically records an entry in `audit_logs`:
  - `booking.cancelled`
  - `booking.checked_in`
  - `booking.checked_out`
  - `booking.expired`

---

## 13. Reviews & Ratings Domain Model (Phase 11)

```text
Customer
   ↓
Completed Booking (status = CHECKED_OUT / COMPLETED)
   ↓
Verified Stay at Hotel
   ↓
Eligible to Review
   ↓
Review Record (1-to-1 with Booking)
```

### 13.1 Core Invariant: Verified Stay Eligibility Rule
A customer is **never** permitted to review a hotel merely by knowing its public identifier or querying its endpoint.
A customer is eligible to submit a review if and only if all three server-enforced conditions hold:
1. **Ownership**: `booking.customerId === currentUser.id` (Authoritative customer identity from JWT; prevents fake reviews and IDOR).
2. **Completion**: `booking.status === CHECKED_OUT || booking.status === COMPLETED` (Guest has physically completed the stay; unconfirmed, pending, or cancelled bookings cannot be reviewed).
3. **Property Relationship**: `hotelId = booking.hotelId` (Authoritatively linked to the actual hotel booked; the client cannot specify or mutate the hotel).

### 13.2 One Review Per Booking & Concurrency Protection
* **Single Review Invariant**: Every completed booking produces at most one review.
* **Database Unique Invariant**: PostgreSQL table `reviews` enforces `@unique @map("booking_id")` (`reviews_booking_id_key`).
* **Concurrent Race Defense**: Even under simultaneous concurrent HTTP requests submitting reviews for the same booking:
  - Exactly one request succeeds in inserting the review (`201 CREATED`).
  - The second request collides on `reviews_booking_id_key`, triggering Prisma `P2002`, which is caught and mapped to `409 CONFLICT` (`REVIEW_ALREADY_EXISTS`).

### 13.3 Review Immutability of Relationships
Once created, a review's relational anchors are permanent and immutable:
- `bookingId`: Permanent link to verified reservation.
- `customerId`: Permanent link to author.
- `hotelId`: Permanent link to property.
The client can never change these fields or transfer a review from Hotel A to Hotel B. Only `rating` (1–5), optional `title`, and `comment` (plain text, 5–2000 characters) may be updated.

### 13.4 Rating Rules & PostgreSQL Check Constraint
* Ratings are strictly integers between `1` and `5` inclusive.
* Enforced via class-validator `@Min(1)`, `@Max(5)`, `@IsInt()`, and backed by PostgreSQL table check constraint `chk_reviews_rating` (`CHECK ("rating" BETWEEN 1 AND 5)`).
* Floating-point ratings (e.g. 4.5) are strictly rejected.

### 13.5 Rating Aggregation & Precision
* **PostgreSQL Engine Aggregation**: Average ratings, total counts, and distribution buckets are computed entirely within PostgreSQL using `_avg`, `_count`, and `groupBy`. Reviews are never loaded en masse into JavaScript memory to compute summaries.
* **Precision Convention**: `averageRating` is consistently rounded to one decimal place (`Math.round(avg * 10) / 10`).
* **Distribution Buckets**: A fixed dictionary mapping `'1'`, `'2'`, `'3'`, `'4'`, `'5'` to review count totals.

### 13.6 Privacy-Preserving Reviewer Presentation
* Public reviews conceal all sensitive customer information:
  - Passwords and password hashes are never selected.
  - Customer emails and phone numbers are excluded.
  - Reviewer is represented as a safe display name (e.g. `"Aarav S."` or `"Guest"`).

### 13.7 Administrative Moderation & Manager Access Boundary
* **Administrative Moderation**: Admins can toggle `isPublished` (`PATCH /api/v1/admin/reviews/:id/moderation`). Concealed reviews (`isPublished: false`) are immediately omitted from public listing and public aggregation.
* **Manager Isolation**: Hotel managers can view reviews for properties they manage via `GET /api/v1/manager/hotels/:hotelId/reviews`. Manager authorization is enforced strictly via `HotelAuthorizationService.assertManagerAccess`. Managers cannot delete or modify customer reviews.

---

## 14. Notifications Domain Model (Phase 12)

```text
Domain Event (Booking / Payment / Review)
    ↓
NotificationsService (Backend Domain Dispatcher)
    ↓
PostgreSQL Notification Entity (Persistent Storage)
    ↓
REST Consumer (Customer / Manager / Admin)
```

### 14.1 Notification Lifecycle & State Machine
Every notification record represents an event-driven communication artifact with an explicit lifecycle:
```text
  [Created] (isRead = false, readAt = null)
      │
      ├── (markAsRead / markAllAsRead)
      ▼
   [Read] (isRead = true, readAt = timestamp)
```
- **Read Idempotency**: Marking an already-read notification as read preserves the initial `readAt` timestamp and returns the entity safely without error or mutation.

### 14.2 Authoritative State vs. Notification Artifacts
* **Authoritative Principle**:
  > **Notifications are NEVER the source of truth.**  
  > `Booking.status` and `Payment.status` remain the sole authoritative source of truth. If a notification fails to persist, the underlying business operation (e.g., booking creation or payment settlement) is preserved and not rolled back.
* Frontend clients consume notification metadata (`data.bookingId`, `data.hotelId`) to navigate and query authoritative domain endpoints.

### 14.3 Multi-Tenant Manager Routing & Isolation
* Notifications intended for property managers (e.g., `BOOKING_CREATED`, `BOOKING_CANCELLED`, `CHECK_IN_COMPLETED`, `CHECK_OUT_COMPLETED`, `REVIEW_CREATED`) are dynamically routed to assigned staff using the authoritative `hotel_managers` join table.
* Managers assigned to Hotel A never receive notification alerts for events occurring at Hotel B.

### 14.4 Future Real-Time (SSE) Integration Design
* Phase 12 provides complete PostgreSQL persistence and REST API delivery.
* The centralized `NotificationsService.create` dispatcher provides the single integration point for future Server-Sent Events (SSE) or WebSockets in subsequent phases without refactoring domain logic.






