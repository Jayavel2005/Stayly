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


