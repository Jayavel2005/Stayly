# Stayora — API Specification: Hotel Management (Phase 5)

> **API Contract & Integration Guide**  
> **Base URL:** `http://localhost:4000/api/v1`  
> **Documentation:** `http://localhost:4000/api/docs` (Swagger / OpenAPI 3.0)  
> **Target Clients:** Customer Web (`:3000`), Manager Web (`:3001`), Admin Web (`:3002`)  

---

## 1. Overview & Route Segregation

Stayora strictly delineates hotel endpoints across three operational spheres:

1. **Public Discovery (`/hotels`, `/hotels/:id`)**: Unauthenticated endpoints for customers and visitors searching active hotel properties with database-backed pagination, sorting, and multi-criteria filters.
2. **Manager Property Management (`/manager/hotels/*`)**: Authenticated endpoints restricted to users with the `HOTEL_MANAGER` role. Access to individual properties strictly requires an explicit assignment in the `hotel_managers` join table.
3. **Administrative Governance (`/admin/hotels/*`)**: Authenticated endpoints restricted to users with the `ADMIN` role. Permits system-wide property creation, auditing, and manager assignment workflows.

---

## 2. Public Discovery Endpoints

### 2.1 List & Search Hotels
* **Endpoint:** `GET /api/v1/hotels`
* **Access:** Public (No authentication required)
* **Query Parameters:**
  | Parameter | Type | Default | Description |
  | :--- | :--- | :--- | :--- |
  | `page` | integer | `1` | Page number (min: 1) |
  | `limit` | integer | `20` | Items per page (min: 1, max: 100) |
  | `city` | string | - | Case-insensitive substring match |
  | `state` | string | - | State/province filter |
  | `country` | string | - | Country filter |
  | `search` | string | - | Text search against hotel name |
  | `starRating` | integer | - | Exact star rating (1–5) |
  | `minRating` | integer | - | Minimum star rating threshold (1–5) |
  | `sortBy` | string | `createdAt` | Sort field: `name`, `starRating`, `createdAt`, `city` |
  | `sortOrder` | string | `desc` | Direction: `asc`, `desc` |

* **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "data": {
      "items": [
        {
          "id": "44444444-4444-4444-8444-444444444444",
          "name": "Stayora Grand Palace",
          "slug": "stayora-grand-palace",
          "description": "A magnificent luxury heritage hotel overlooking the Arabian Sea.",
          "starRating": 5,
          "addressLine1": "Apollo Bunder, Colaba",
          "city": "Mumbai",
          "state": "Maharashtra",
          "country": "India",
          "postalCode": "400001",
          "latitude": 18.922,
          "longitude": 72.8347,
          "checkInTime": "1970-01-01T14:00:00.000Z",
          "checkOutTime": "1970-01-01T11:00:00.000Z",
          "_count": {
            "roomTypes": 3
          }
        }
      ],
      "meta": {
        "page": 1,
        "limit": 20,
        "total": 1,
        "totalPages": 1
      }
    }
  }
  ```

### 2.2 Get Active Hotel by ID
* **Endpoint:** `GET /api/v1/hotels/:id`
* **Access:** Public
* **Success Response (`200 OK`):** Full hotel profile including active room types.
* **Error Response (`404 NOT_FOUND`):** If hotel does not exist or has been deactivated/soft-deleted.

---

## 3. Manager Property Endpoints

All manager endpoints require `Authorization: Bearer <JWT>` where the token possesses `role: HOTEL_MANAGER`.

### 3.1 List Managed Hotels
* **Endpoint:** `GET /api/v1/manager/hotels`
* **Behavior:** Queries only hotels assigned to the calling manager (`hotel_managers.user_id = user.id`).

### 3.2 Get Managed Hotel by ID
* **Endpoint:** `GET /api/v1/manager/hotels/:hotelId`
* **Authorization Invariant:** Manager must be assigned to this hotel.
* **Error Response (`403 FORBIDDEN`):** If manager is not assigned to the hotel property.

### 3.3 Update Managed Hotel
* **Endpoint:** `PATCH /api/v1/manager/hotels/:hotelId`
* **Payload:**
  ```json
  {
    "name": "Stayora Grand Palace Mumbai",
    "description": "Updated luxury suites description.",
    "phone": "+912266659999",
    "email": "concierge.mumbai@stayora.com",
    "starRating": 5
  }
  ```
* **Success Response (`200 OK`):** Returns updated hotel record.

### 3.4 Deactivate Managed Hotel
* **Endpoint:** `DELETE /api/v1/manager/hotels/:hotelId`
* **Behavior:** Soft-deletes hotel (`isActive: false, deletedAt: now()`). Preserves all historical records.

---

## 4. Admin Property Governance Endpoints

All admin endpoints require `Authorization: Bearer <JWT>` where the token possesses `role: ADMIN`.

### 4.1 Create Hotel Property
* **Endpoint:** `POST /api/v1/admin/hotels`
* **Payload:**
  ```json
  {
    "name": "Stayora Valley Resort",
    "slug": "stayora-valley-resort",
    "description": "Exclusive valley resort with mountain view suites.",
    "starRating": 4,
    "addressLine1": "Main Bypass Road",
    "city": "Manali",
    "state": "Himachal Pradesh",
    "country": "India",
    "postalCode": "175131",
    "latitude": 32.2396,
    "longitude": 77.1887,
    "phone": "+911902250000",
    "email": "manali@stayora.com",
    "checkInTime": "14:00",
    "checkOutTime": "11:00",
    "isActive": true,
    "initialManagerId": "22222222-2222-4222-8222-222222222222"
  }
  ```
* **Success Response (`201 CREATED`):** Returns created hotel record.
* **Error Response (`409 CONFLICT`):** If slug already exists.

### 4.2 List All Hotels (Admin Overview)
* **Endpoint:** `GET /api/v1/admin/hotels`
* **Behavior:** Returns system-wide list of all hotels (including inactive), manager assignment records, and room counts.

### 4.3 Assign Manager to Hotel
* **Endpoint:** `POST /api/v1/admin/hotels/:hotelId/managers`
* **Payload:**
  ```json
  {
    "managerId": "22222222-2222-4222-8222-222222222222",
    "isPrimary": true
  }
  ```
* **Success Response (`200 OK`):** Returns created assignment record.

### 4.4 Unassign Manager from Hotel
* **Endpoint:** `DELETE /api/v1/admin/hotels/:hotelId/managers/:managerId`
* **Success Response (`200 OK`):** `{ "success": true, "data": { "message": "Manager assignment successfully revoked." } }`

---

## 5. Room Categories & Types Endpoints (`/api/v1/room-types`)

### 5.1 Create Room Category
* **Endpoint:** `POST /api/v1/room-types`
* **Access:** Authenticated (`ADMIN` or assigned `HOTEL_MANAGER`)
* **Payload:**
  ```json
  {
    "hotelId": "44444444-4444-4444-8444-444444444444",
    "name": "Deluxe Sea View Suite",
    "slug": "deluxe-sea-view-suite",
    "description": "Luxurious suite featuring king bed, panoramic ocean views, and private balcony.",
    "maxOccupancy": 3,
    "maxAdults": 2,
    "maxChildren": 1,
    "basePriceCents": 850000,
    "currency": "INR",
    "bedType": "KING",
    "sizeSqMeters": 48.5,
    "isActive": true
  }
  ```
* **Success Response (`201 CREATED`):** Created RoomType record.
* **Error Response (`403 FORBIDDEN`):** If manager is not assigned to `hotelId`.
* **Error Response (`409 CONFLICT`):** Duplicate slug in the same hotel property.

### 5.2 List & Filter Room Categories
* **Endpoint:** `GET /api/v1/room-types`
* **Access:** Public (Role-aware filtering)
* **Query Parameters:**
  | Parameter | Type | Default | Description |
  | :--- | :--- | :--- | :--- |
  | `page` | integer | `1` | Page number |
  | `limit` | integer | `20` | Items per page (max: 100) |
  | `hotelId` | UUID | - | Filter by parent hotel property |
  | `search` | string | - | Search by category name or description |
  | `isActive` | boolean | - | Operational status filter |
  | `sortBy` | string | `createdAt` | Sort field: `name`, `basePriceCents`, `maxOccupancy`, `createdAt` |
  | `sortOrder` | string | `desc` | Direction: `asc`, `desc` |
* **Behavior:** Public visitors receive only active categories for active hotels; managers receive categories belonging to their assigned properties; admins receive global listings.

### 5.3 Get Room Category by ID
* **Endpoint:** `GET /api/v1/room-types/:id`
* **Access:** Public (Returns 404 if category or parent hotel is inactive/deleted)

### 5.4 Update Room Category
* **Endpoint:** `PATCH /api/v1/room-types/:id`
* **Access:** Authenticated (`ADMIN` or assigned `HOTEL_MANAGER`)
* **Behavior:** Partial updates for pricing, capacity, and bedding. Moving categories between hotels is prohibited.

### 5.5 Delete Room Category
* **Endpoint:** `DELETE /api/v1/room-types/:id`
* **Access:** Authenticated (`ADMIN` or assigned `HOTEL_MANAGER`)
* **Invariant:** If active physical inventory rooms exist under this category, deletion is blocked with `409 CONFLICT` (`ROOM_TYPE_HAS_ROOMS`).

---

## 6. Physical Room Inventory Endpoints (`/api/v1/rooms`)

Physical room inventory endpoints are restricted to property management (`HOTEL_MANAGER`) and administrative governance (`ADMIN`). Customers cannot directly list or query individual operational room units.

### 6.1 Create Physical Room
* **Endpoint:** `POST /api/v1/rooms`
* **Access:** Authenticated (`ADMIN` or assigned `HOTEL_MANAGER`)
* **Payload:**
  ```json
  {
    "roomTypeId": "33333333-3333-4333-8333-333333333333",
    "roomNumber": "101",
    "floor": 1,
    "operationalStatus": "AVAILABLE"
  }
  ```
* **Hotel Derivation:** The parent hotel is strictly derived from `roomTypeId`.
* **Database Invariant:** Room numbers are unique per hotel property (`UNIQUE(hotel_id, room_number)`). Duplicate numbers within the same hotel are rejected (`409 CONFLICT`). Different hotels may reuse the same room number.

### 6.2 List & Filter Physical Rooms
* **Endpoint:** `GET /api/v1/rooms`
* **Access:** Authenticated (`ADMIN` or assigned `HOTEL_MANAGER`)
* **Query Parameters:**
  | Parameter | Type | Default | Description |
  | :--- | :--- | :--- | :--- |
  | `page` | integer | `1` | Page number |
  | `limit` | integer | `20` | Items per page (max: 100) |
  | `hotelId` | UUID | - | Filter by hotel property |
  | `roomTypeId` | UUID | - | Filter by room category |
  | `operationalStatus` | string | - | Enum: `AVAILABLE`, `OCCUPIED`, `MAINTENANCE`, `OUT_OF_SERVICE` |
  | `floor` | integer | - | Floor filter |
  | `search` | string | - | Search room number |

### 6.3 Get Physical Room by ID
* **Endpoint:** `GET /api/v1/rooms/:id`
* **Access:** Authenticated (`ADMIN` or assigned `HOTEL_MANAGER`)

### 6.4 Update Physical Room
* **Endpoint:** `PATCH /api/v1/rooms/:id`
* **Access:** Authenticated (`ADMIN` or assigned `HOTEL_MANAGER`)
* **Reassignment Invariant:** A room may be reassigned to another `roomTypeId` only if the target category belongs to the **SAME** hotel property (`400 BAD_REQUEST` on cross-hotel mismatch).

### 6.5 Update Operational Status
* **Endpoint:** `PATCH /api/v1/rooms/:id/status`
* **Access:** Authenticated (`ADMIN` or assigned `HOTEL_MANAGER`)
* **Payload:**
  ```json
  {
    "status": "MAINTENANCE"
  }
  ```

### 6.6 Soft-Delete Physical Room
* **Endpoint:** `DELETE /api/v1/rooms/:id`
* **Access:** Authenticated (`ADMIN` or assigned `HOTEL_MANAGER`)
* **Behavior:** Sets `operationalStatus = OUT_OF_SERVICE` and sets `deletedAt = now()`.

---

## 7. Hotel Search & Date Availability (Phase 7)

### 7.1 Search Available Hotels
* **Endpoint:** `GET /api/v1/search/hotels`
* **Access:** Public (No authentication required)
* **Date Semantics:** Half-open interval `[checkIn, checkOut)` where check-in is inclusive and check-out is exclusive.
* **Overlap Invariant:** A room is allocated/conflicting if `existing.checkIn < requested.checkOut AND existing.checkOut > requested.checkIn`.
* **Inventory Rule:** A physical room is available if and only if `operationalStatus = AVAILABLE` AND it has no active overlapping `BookingRoom` record in `RESERVED` or `OCCUPIED` status under a non-expired booking in `PENDING`, `CONFIRMED`, or `CHECKED_IN` status.
* **Query Parameters:**
  | Parameter | Type | Required | Default | Description |
  | :--- | :--- | :--- | :--- | :--- |
  | `checkIn` | string (`YYYY-MM-DD`) | **Yes** | - | Requested calendar check-in date (`>= today`) |
  | `checkOut` | string (`YYYY-MM-DD`) | **Yes** | - | Requested calendar check-out date (`> checkIn`) |
  | `guests` | integer | No | `1` | Number of guests (capacity check: `roomType.maxOccupancy >= guests`) |
  | `rooms` | integer | No | `1` | Number of rooms requested per room category |
  | `city` | string | No | - | Case-insensitive city substring filter |
  | `state` | string | No | - | State/province filter |
  | `country` | string | No | - | Country filter |
  | `search` | string | No | - | Hotel name or description search |
  | `hotelId` | UUID | No | - | Restrict search to specific hotel |
  | `roomTypeId` | UUID | No | - | Restrict search to specific room category |
  | `starRating` | integer (1–5) | No | - | Exact hotel star classification |
  | `minRating` | integer (1–5) | No | - | Minimum star rating threshold |
  | `page` | integer | No | `1` | Page number (min: 1) |
  | `limit` | integer | No | `20` | Items per page (min: 1, max: 100) |
  | `sortBy` | string | No | `createdAt` | Sort field: `name`, `starRating`, `createdAt`, `price` |
  | `sortOrder` | string | No | `asc` | Direction: `asc`, `desc` |

* **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "data": {
      "items": [
        {
          "id": "44444444-4444-4444-8444-444444444444",
          "hotelId": "44444444-4444-4444-8444-444444444444",
          "name": "Stayora Grand Palace",
          "hotelName": "Stayora Grand Palace",
          "slug": "stayora-grand-palace",
          "city": "Mumbai",
          "state": "Maharashtra",
          "country": "India",
          "starRating": 5,
          "minPriceCents": "450000",
          "totalAvailableRooms": 7,
          "roomTypes": [
            {
              "id": "57391b9b-ed2d-4e3d-bb09-63728b53254f",
              "roomTypeId": "57391b9b-ed2d-4e3d-bb09-63728b53254f",
              "name": "Classic Heritage Room",
              "slug": "classic-heritage-room",
              "maxOccupancy": 2,
              "basePriceCents": "450000",
              "currency": "INR",
              "bedType": "KING",
              "availableRooms": 2,
              "totalRooms": 3,
              "totalOperationalRooms": 3
            }
          ]
        }
      ],
      "meta": {
        "page": 1,
        "limit": 20,
        "total": 1,
        "totalPages": 1,
        "checkIn": "2026-10-10",
        "checkOut": "2026-10-12",
        "totalNights": 2,
        "guests": 2,
        "rooms": 1
      }
    }
  }
  ```

### 7.2 Get Hotel Availability
* **Endpoint:** `GET /api/v1/availability/hotels/:hotelId`
* **Access:** Public (No authentication required)
* **Query Parameters:** `checkIn` (required), `checkOut` (required), `guests` (optional), `rooms` (optional)
* **Description:** Returns detailed date-range availability breakdown across all active room categories for the specified hotel property.
* **Error Semantics:** `404 Not Found` if hotel is not found or inactive.

### 7.3 Get RoomType Availability
* **Endpoint:** `GET /api/v1/availability/room-types/:roomTypeId`
* **Access:** Public (No authentication required)
* **Query Parameters:** `checkIn` (required), `checkOut` (required)
* **Description:** Returns availability summary including `totalOperationalRooms`, `occupiedRooms`, `availableRooms`, `hasAvailability`, and concrete available room IDs.
* **Error Semantics:** `404 Not Found` if room category is not found or inactive.

### 7.4 Architectural Note: Search vs. Booking Guarantee
* **Search is a Read Operation:** Search results reflect instantaneous inventory state and do **NOT** lock or reserve inventory.
* **Atomic Booking Reservation:** Phase 8 Booking Engine must independently perform transactional availability validation with database row locking (`SELECT FOR UPDATE` / serializable transaction).

---

## 8. Reservations & Booking Engine (Phase 8)

### 8.1 Create Reservation & Allocate Inventory
* **Endpoint:** `POST /api/v1/bookings`
* **Access:** Authenticated (`CUSTOMER` only via JWT)
* **Payload:**
  ```json
  {
    "hotelId": "44444444-4444-4444-8444-444444444444",
    "roomTypeId": "57391b9b-ed2d-4e3d-bb09-63728b53254f",
    "checkIn": "2026-10-20",
    "checkOut": "2026-10-23",
    "guests": 2,
    "rooms": 1
  }
  ```
* **Transactional Invariants:**
  1. **Authoritative Re-check:** Availability from Phase 7 search is non-authoritative. The booking engine executes an authoritative availability re-check inside an explicit PostgreSQL transaction (`$transaction`).
  2. **Pessimistic Row-Level Locking:** Physical operational rooms (`operationalStatus = AVAILABLE`) are locked in deterministic order (`ORDER BY room_number ASC FOR UPDATE`), preventing concurrent race conditions.
  3. **Double-Booking Defense:** PostgreSQL native GiST exclusion constraint (`exclude_overlapping_room_allocations`) guarantees zero overlapping active reservations at the database engine level.
  4. **Automatic Physical Allocation:** Customers book a room category; the engine selects and links specific brick-and-mortar units in `booking_rooms`.
  5. **Price Snapshot:** Freezes historical rates (`base_rate_cents`, `gross_room_cents`, `net_amount_cents`) in `booking_price_snapshots` using exact integer cents.
  6. **Inventory Hold Window:** Initial status is `PENDING` with `holdExpiresAt = NOW() + 15 minutes`.
* **Response (`201 Created`):**
  ```json
  {
    "success": true,
    "data": {
      "id": "11111111-2222-3333-4444-555555555555",
      "bookingReference": "STY-202610-K8J2P9",
      "status": "PENDING",
      "checkIn": "2026-10-20",
      "checkOut": "2026-10-23",
      "totalNights": 3,
      "totalGuests": 2,
      "roomsCount": 1,
      "totalAmount": "13500.00",
      "totalAmountCents": "1350000",
      "currency": "INR",
      "holdExpiresAt": "2026-10-20T12:15:00.000Z",
      "hotel": {
        "id": "44444444-4444-4444-8444-444444444444",
        "name": "Stayora Grand Palace",
        "slug": "stayora-grand-palace",
        "city": "Mumbai"
      },
      "roomType": {
        "id": "57391b9b-ed2d-4e3d-bb09-63728b53254f",
        "name": "Classic Heritage Room",
        "slug": "classic-heritage-room"
      },
      "allocatedRooms": [
        { "id": "...", "roomNumber": "101", "floor": 1 }
      ],
      "priceSnapshot": {
        "baseRate": "4500.00",
        "grossAmount": "13500.00",
        "netAmount": "13500.00",
        "currency": "INR"
      }
    }
  }
  ```
* **Error Semantics:**
  - `400 BAD_REQUEST`: Invalid dates, past check-in, capacity exceeded, or cross-hotel mismatch.
  - `401 UNAUTHORIZED`: Missing or invalid JWT.
  - `403 FORBIDDEN`: Non-customer role attempting reservation creation.
  - `404 NOT_FOUND`: Hotel or RoomType not found or inactive.
  - `409 CONFLICT` (`ROOM_NOT_AVAILABLE`): Insufficient available physical rooms for requested dates.

### 8.2 List Bookings (Role-Scoped)
* **Endpoint:** `GET /api/v1/bookings`
* **Access:** Authenticated (`CUSTOMER`, `HOTEL_MANAGER`, `ADMIN`)
* **Role Scoping:**
  - `CUSTOMER`: Returns only personal reservations.
  - `HOTEL_MANAGER`: Returns only reservations for properties assigned to the manager.
  - `ADMIN`: Returns all reservations platform-wide.
* **Query Parameters:** `page`, `limit`, `status`, `hotelId`, `customerId` (admin only).

### 8.3 Get Booking by ID
* **Endpoint:** `GET /api/v1/bookings/:id`
* **Access:** Authenticated (`CUSTOMER`, `HOTEL_MANAGER`, `ADMIN`)
* **IDOR Defense:** Non-owners and unassigned managers receive `404 NOT_FOUND` to prevent resource existence disclosure.

### 8.4 Cancel Reservation
* **Endpoint:** `PATCH /api/v1/bookings/:id/cancel`
* **Access:** Authenticated (Booking owner `CUSTOMER`, assigned `HOTEL_MANAGER`, or `ADMIN`)
* **Behavior:** Transitions status to `CANCELLED`, records `cancelledAt` and `cancellationReason`, and releases allocated rooms (`status = CANCELLED`), making them immediately available to other guests.

### 8.5 Update Booking Lifecycle Status
* **Endpoint:** `PATCH /api/v1/bookings/:id/status`
* **Access:** Authenticated (`HOTEL_MANAGER`, `ADMIN`)
* **Payload:** `{ "status": "CHECKED_IN" }`
* **Lifecycle Validation:**
  - `PENDING` → `CONFIRMED`, `CANCELLED`, `EXPIRED`
  - `CONFIRMED` → `CHECKED_IN`, `CANCELLED`, `NO_SHOW`
  - `CHECKED_IN` → `CHECKED_OUT`
  - Terminal states (`CANCELLED`, `CHECKED_OUT`, `EXPIRED`, `NO_SHOW`) cannot be transitioned.

---

## 9. Payments & Payment Attempts (Phase 9)

### 9.1 Process Payment Attempt
* **Endpoint:** `POST /api/v1/payments`
* **Access:** Authenticated (`CUSTOMER`, `ADMIN`)
* **Headers:**
  | Header | Type | Required | Description |
  | :--- | :--- | :--- | :--- |
  | `Idempotency-Key` | string / UUID | **Yes** | Client-generated token guaranteeing exactly-once execution |
* **Request Payload (`CreatePaymentDto`):**
  ```json
  {
    "bookingId": "10594466-e472-4e5b-887f-1e624e255292",
    "paymentMethod": "CARD",
    "simulateResult": "SUCCESS",
    "simulateFailureReason": "Optional test reason"
  }
  ```
  *(Note: `amount` and `userId` are never accepted from the client; they are derived authoritatively from the booking and authenticated JWT).*
* **Success Response (`201 Created`):**
  ```json
  {
    "success": true,
    "data": {
      "id": "7d549d09-7d54-4c2a-86a1-06aa54d2513e",
      "bookingId": "10594466-e472-4e5b-887f-1e624e255292",
      "bookingReference": "STY-202610-0001",
      "transactionReference": "TXN-1727800000000-ABCDEF",
      "status": "SUCCEEDED",
      "amount": "15000.00",
      "currency": "INR",
      "gatewayProvider": "MOCK",
      "paymentMethod": "CARD",
      "failureReason": null,
      "settledAt": "2026-10-01T12:00:01.000Z",
      "createdAt": "2026-10-01T12:00:00.000Z",
      "attempts": [
        {
          "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
          "attemptNumber": 1,
          "idempotencyKey": "IDEMP-8c4c6f4e-202610-001",
          "amount": "15000.00",
          "currency": "INR",
          "status": "SUCCEEDED",
          "gatewayProvider": "MOCK",
          "gatewayReference": "MOCK-TXN-1727800000000-3FA85F64",
          "paymentMethod": "CARD",
          "failureReason": null,
          "createdAt": "2026-10-01T12:00:00.000Z",
          "updatedAt": "2026-10-01T12:00:01.000Z"
        }
      ]
    }
  }
  ```
* **Error Semantics:**
  - `400 BAD_REQUEST`: Missing `Idempotency-Key` header (`IDEMPOTENCY_KEY_REQUIRED`), booking not in payable state (`BOOKING_NOT_PAYABLE`), or expired reservation hold.
  - `401 UNAUTHORIZED`: Missing or invalid JWT.
  - `403 FORBIDDEN`: Non-customer role or customer attempting payment on another user's reservation (`FORBIDDEN_RESOURCE`).
  - `404 NOT_FOUND`: Booking not found (`BOOKING_NOT_FOUND`).
  - `409 CONFLICT`:
    - `PAYMENT_ALREADY_COMPLETED`: Booking already successfully paid and confirmed.
    - `IDEMPOTENCY_KEY_REUSED`: Same Idempotency-Key reused for a different booking.
    - `PAYMENT_IN_PROGRESS`: Simultaneous active attempt in progress.

### 9.2 Get Payment Details by ID
* **Endpoint:** `GET /api/v1/payments/:id`
* **Access:** Authenticated (`CUSTOMER` who owns the booking, `ADMIN`)
* **Manager Isolation:** Hotel managers receive `403 FORBIDDEN` to prevent exposure of sensitive guest financial ledger data.
* **Success Response (`200 OK`):**
  Returns complete `PaymentResponseDto` including all historical `PaymentAttempt` records.

### 9.3 List Payments
* **Endpoint:** `GET /api/v1/payments`
* **Access:** Authenticated (`CUSTOMER`, `ADMIN`)
* **Scoping:**
  - `CUSTOMER`: Filtered strictly to bookings belonging to the authenticated customer.
  - `ADMIN`: Platform-wide ledger with optional `bookingId` filter and pagination.
  - `HOTEL_MANAGER`: Receives `403 FORBIDDEN`.

---

## 10. Booking Lifecycle & Cancellation Endpoints (Phase 10)

### 10.1 Cancel Reservation
* **Primary Endpoint:** `POST /api/v1/bookings/:id/cancel`
* **Legacy/Compatibility Endpoint:** `PATCH /api/v1/bookings/:id/cancel`
* **Access:**
  - `CUSTOMER`: May cancel own active reservation (`PENDING` or `CONFIRMED`). Attempting to cancel another customer's reservation returns `404 NOT_FOUND` (IDOR defense).
  - `HOTEL_MANAGER`: May cancel reservations for assigned properties. Unassigned properties return `404 NOT_FOUND`.
  - `ADMIN`: Global cancellation authority.
* **Request Body (Optional):**
  ```json
  {
    "reason": "Change of travel plans"
  }
  ```
* **State Transition Rules:**
  - Permitted from: `PENDING`, `CONFIRMED`.
  - Forbidden from: `CHECKED_IN` (`400 BOOKING_NOT_CANCELLABLE`), `CHECKED_OUT` (`400 INVALID_STATE_TRANSITION`), `EXPIRED` (`400 INVALID_STATE_TRANSITION`).
  - Already cancelled: `400 BOOKING_ALREADY_CANCELLED`.
* **Side Effects & Invariants:**
  - Booking status updated to `CANCELLED` and `cancelled_at` / `cancellation_reason` recorded.
  - All allocated physical room records in `booking_rooms` transition to `CANCELLED`.
  - **No Records Deleted**: Reservation and allocations remain in the database permanently for historical auditing.
  - **Availability Released**: Real-time availability queries immediately ignore `CANCELLED` allocations.
  - **Payment Consistency**: Paid reservations preserve the `Payment` record as `SUCCEEDED`. Real refund provider processing is deferred to a dedicated refund phase; no fake refunds are created.
  - **Audit Logging**: Recorded in `audit_logs` with action `booking.cancelled`.
* **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "data": {
      "id": "10594466-e472-4e5b-887f-1e624e255292",
      "bookingReference": "STY-202610-A1B2C3",
      "status": "CANCELLED",
      "checkIn": "2026-11-01",
      "checkOut": "2026-11-04",
      "totalNights": 3,
      "totalGuests": 2,
      "roomsCount": 1,
      "totalAmount": "15000.00",
      "currency": "INR",
      "cancelledAt": "2026-10-01T17:30:00.000Z",
      "cancellationReason": "Change of travel plans",
      "message": "Booking cancelled successfully."
    }
  }
  ```

### 10.2 Operational Check-In
* **Endpoint:** `POST /api/v1/bookings/:id/check-in`
* **Access:** Authenticated `HOTEL_MANAGER` (assigned to hotel) or `ADMIN`.
* **Customer Isolation:** Customers receive `403 FORBIDDEN`.
* **State Transition Rules:**
  - Permitted strictly from: `CONFIRMED`.
  - Rejection from `PENDING`: `400 BOOKING_NOT_CHECKINABLE` (must be paid and confirmed first).
  - Rejection from `CANCELLED`, `EXPIRED`, `CHECKED_OUT`: `400 BOOKING_NOT_CHECKINABLE`.
  - Repeated Check-In: `400 BOOKING_ALREADY_CHECKED_IN` (idempotent side-effect protection).
* **Stay Period Date Rule:**
  - Check-in is allowed on or after reservation start date (`[checkInDate, checkOutDate)`).
  - Check-in is rejected if the scheduled checkout date has already passed (`now >= checkOutDate`).
* **Side Effects & Invariants:**
  - Booking status updated to `CHECKED_IN` and `checked_in_at` timestamp recorded.
  - Allocated room status in `booking_rooms` transitions to `OCCUPIED`.
  - Physical room `operationalStatus` is preserved (not mutated).
  - Audit record created with action `booking.checked_in`.
* **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "data": {
      "id": "10594466-e472-4e5b-887f-1e624e255292",
      "bookingReference": "STY-202610-A1B2C3",
      "status": "CHECKED_IN",
      "checkedInAt": "2026-11-01T14:05:00.000Z",
      "message": "Booking checked in successfully."
    }
  }
  ```

### 10.3 Operational Check-Out
* **Endpoint:** `POST /api/v1/bookings/:id/check-out`
* **Access:** Authenticated `HOTEL_MANAGER` (assigned to hotel) or `ADMIN`.
* **Customer Isolation:** Customers receive `403 FORBIDDEN`.
* **State Transition Rules:**
  - Permitted strictly from: `CHECKED_IN`.
  - Rejection from `CONFIRMED`, `PENDING`, `CANCELLED`: `400 BOOKING_NOT_CHECKOUTABLE`.
  - Repeated Check-Out: `400 BOOKING_ALREADY_COMPLETED`.
* **Side Effects & Invariants:**
  - Booking status updated to `CHECKED_OUT` (completed) and `checked_out_at` timestamp recorded.
  - Allocated room status in `booking_rooms` transitions to `RELEASED`.
  - Historical allocations are preserved and do NOT block future availability searches.
  - Audit record created with action `booking.checked_out`.
* **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "data": {
      "id": "10594466-e472-4e5b-887f-1e624e255292",
      "bookingReference": "STY-202610-A1B2C3",
      "status": "CHECKED_OUT",
      "checkedOutAt": "2026-11-04T10:30:00.000Z",
      "message": "Booking checked out successfully."
    }
  }
  ```

### 10.4 State Machine Transition (General Handler)
* **Endpoint:** `PATCH /api/v1/bookings/:id/status`
* **Access:** Authenticated `HOTEL_MANAGER` (assigned to hotel) or `ADMIN`.
* **Body:**
  ```json
  {
    "status": "CONFIRMED"
  }
  ```
* **Supported Transitions:**
  - `PENDING -> CONFIRMED` (Manual staff confirmation)
  - `CONFIRMED -> CHECKED_IN` (Delegates to check-in)
  - `CHECKED_IN -> CHECKED_OUT` (Delegates to check-out)
  - `CONFIRMED -> CANCELLED` (Delegates to cancellation)
  - `CONFIRMED -> NO_SHOW` (Releases rooms to `RELEASED`)

---

## 11. Reviews & Ratings API Specification (Phase 11)

### 11.1 Create Review
* **Endpoint:** `POST /api/v1/reviews`
* **Access:** Authenticated `CUSTOMER`
* **Headers:** `Authorization: Bearer <JWT>`
* **Eligibility Preconditions (Server-Enforced):**
  1. `booking.customerId === currentUser.id` (Customer ownership verification; IDOR defense).
  2. `booking.status === CHECKED_OUT || booking.status === COMPLETED` (Only verified, completed stays can be reviewed).
  3. `hotelId = booking.hotelId` (Derived authoritatively from booking; client cannot spoof hotel).
  4. One review per booking: Enforced by application check and PostgreSQL database unique constraint `reviews_booking_id_key`. Concurrent submissions safely return `409 REVIEW_ALREADY_EXISTS`.
* **Request Body:**
  ```json
  {
    "bookingId": "8b9c1d2e-3f4a-5b6c-7d8e-9f0a1b2c3d4e",
    "rating": 5,
    "title": "Outstanding Seaside Hospitality",
    "comment": "The ocean-view suite was immaculate and the concierge service exceeded expectations."
  }
  ```
* **Validation Rules:**
  - `bookingId`: Valid UUID (required).
  - `rating`: Integer between `1` and `5` inclusive (required; floating points and values outside range are rejected with `400`).
  - `title`: Optional string, trimmed, max 150 characters.
  - `comment`: String, trimmed, min 5 characters, max 2000 characters (plain text only; rich HTML is not stored).
* **Success Response (`201 CREATED`):**
  ```json
  {
    "success": true,
    "data": {
      "id": "7a8b9c0d-1e2f-3a4b-5c6d-7e8f9a0b1c2d",
      "bookingId": "8b9c1d2e-3f4a-5b6c-7d8e-9f0a1b2c3d4e",
      "hotelId": "44444444-4444-4444-8444-444444444444",
      "rating": 5,
      "title": "Outstanding Seaside Hospitality",
      "comment": "The ocean-view suite was immaculate and the concierge service exceeded expectations.",
      "isPublished": true,
      "createdAt": "2026-10-01T14:30:00.000Z",
      "updatedAt": "2026-10-01T14:30:00.000Z",
      "reviewer": {
        "id": "11111111-1111-4111-8111-111111111111",
        "displayName": "Aarav S."
      }
    }
  }
  ```
* **Error Responses:**
  - `400 BAD_REQUEST`: Invalid input format, or `BOOKING_NOT_COMPLETED` (stay not completed).
  - `401 UNAUTHORIZED`: Missing or invalid authentication token.
  - `403 FORBIDDEN`: `BOOKING_NOT_OWNED` (Customer does not own reservation).
  - `404 NOT_FOUND`: `BOOKING_NOT_FOUND` (Reservation not found).
  - `409 CONFLICT`: `REVIEW_ALREADY_EXISTS` (Duplicate review submission for booking).

### 11.2 Update Review
* **Endpoint:** `PATCH /api/v1/reviews/:id`
* **Access:** Authenticated `CUSTOMER` (Review author) or `ADMIN`
* **Immutable Relationships:** `bookingId`, `customerId`, and `hotelId` cannot be changed. Only `rating`, `title`, and `comment` are mutable.
* **Request Body:**
  ```json
  {
    "rating": 4,
    "title": "Updated Feedback",
    "comment": "Hotel staff promptly resolved our breakfast feedback."
  }
  ```
* **Success Response (`200 OK`):** Updated `ReviewResponse`.
* **Error Responses:**
  - `403 FORBIDDEN`: `FORBIDDEN_RESOURCE` (Attempting to edit someone else's review).
  - `404 NOT_FOUND`: `REVIEW_NOT_FOUND`.

### 11.3 Delete Review
* **Endpoint:** `DELETE /api/v1/reviews/:id`
* **Access:** Authenticated `CUSTOMER` (Review author) or `ADMIN`
* **Behavior:** Permanently deletes review. Hotel rating aggregation adjusts immediately.
* **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "message": "Review deleted successfully."
  }
  ```

### 11.4 Public Hotel Reviews & Aggregation
* **Endpoint:** `GET /api/v1/hotels/:hotelId/reviews`
* **Access:** Public (No authentication required)
* **Query Parameters:**
  | Parameter | Type | Default | Description |
  | :--- | :--- | :--- | :--- |
  | `page` | integer | `1` | Page number |
  | `limit` | integer | `20` | Items per page (max: 100) |
  | `rating` | integer | - | Filter by exact rating (1–5) |
  | `sortBy` | string | `newest` | Allowlisted: `newest`, `oldest`, `highest`, `lowest` |
* **Aggregation Calculation:** Calculated entirely within PostgreSQL via `_avg`, `_count`, and `groupBy`:
  - `averageRating`: Rounded to 1 decimal place.
  - `reviewCount`: Total count of published reviews.
  - `ratingDistribution`: Count of reviews for each star rating (1 through 5).
* **Privacy Safe Representation:** Reviews return only safe public data (`reviewer: { id, displayName: "FirstName L." }`). Sensitive customer emails, phone numbers, and password hashes are never exposed.
* **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "data": {
      "items": [
        {
          "id": "7a8b9c0d-1e2f-3a4b-5c6d-7e8f9a0b1c2d",
          "bookingId": "8b9c1d2e-3f4a-5b6c-7d8e-9f0a1b2c3d4e",
          "hotelId": "44444444-4444-4444-8444-444444444444",
          "rating": 5,
          "title": "Outstanding Seaside Hospitality",
          "comment": "The ocean-view suite was immaculate and the concierge service exceeded expectations.",
          "isPublished": true,
          "createdAt": "2026-10-01T14:30:00.000Z",
          "updatedAt": "2026-10-01T14:30:00.000Z",
          "reviewer": {
            "id": "11111111-1111-4111-8111-111111111111",
            "displayName": "Aarav S."
          }
        }
      ],
      "meta": {
        "page": 1,
        "limit": 20,
        "total": 42,
        "totalPages": 3
      },
      "summary": {
        "averageRating": 4.7,
        "reviewCount": 42,
        "ratingDistribution": {
          "1": 1,
          "2": 1,
          "3": 2,
          "4": 8,
          "5": 30
        }
      }
    }
  }
  ```

### 11.5 Customer Review History
* **Endpoint:** `GET /api/v1/reviews/me`
* **Access:** Authenticated `CUSTOMER`
* **Query Parameters:** `page`, `limit`, `sortBy`
* **Success Response (`200 OK`):** Paginated reviews written by current customer.

### 11.6 Check Review Eligibility
* **Endpoint:** `GET /api/v1/bookings/:bookingId/review-eligibility`
* **Access:** Authenticated `CUSTOMER`
* **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "data": {
      "eligible": true,
      "bookingId": "8b9c1d2e-3f4a-5b6c-7d8e-9f0a1b2c3d4e",
      "reason": null
    }
  }
  ```
  Or if not eligible:
  ```json
  {
    "success": true,
    "data": {
      "eligible": false,
      "bookingId": "8b9c1d2e-3f4a-5b6c-7d8e-9f0a1b2c3d4e",
      "reason": "BOOKING_NOT_COMPLETED"
    }
  }
  ```

### 11.7 Manager Hotel Reviews
* **Endpoint:** `GET /api/v1/manager/hotels/:hotelId/reviews`
* **Access:** Authenticated `HOTEL_MANAGER` (assigned to hotel) or `ADMIN`
* **Authorization Invariant:** Manager access verified via `HotelAuthorizationService.assertManagerAccess`.

### 11.8 Administrative Moderation
* **Endpoint:** `PATCH /api/v1/admin/reviews/:id/moderation`
* **Access:** Authenticated `ADMIN`
* **Body:**
  ```json
  {
    "isPublished": false
  }
  ```
* **Behavior:** Toggles review visibility. Concealed (`isPublished: false`) reviews are excluded from public discovery and public rating aggregation.

---

## 12. Notifications API Specification (Phase 12)

All notification endpoints require authentication with `Authorization: Bearer <JWT>`. The authenticated identity is derived strictly server-side from JWT (`currentUser.id`).

### 12.1 List User Notifications
* **Endpoint:** `GET /api/v1/notifications`
* **Access:** Authenticated Users (`CUSTOMER`, `HOTEL_MANAGER`, `ADMIN`)
* **Query Parameters:**
  | Parameter | Type | Default | Description |
  | :--- | :--- | :--- | :--- |
  | `page` | integer | `1` | Page number (min: 1) |
  | `limit` | integer | `20` | Items per page (min: 1, max: 100) |
  | `isRead` | boolean | - | Filter by read status (`true` or `false`) |
  | `sortBy` | string | `newest` | Sort ordering allowlist: `newest`, `oldest` |
* **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "data": {
      "items": [
        {
          "id": "7a8b9c0d-1e2f-3a4b-5c6d-7e8f9a0b1c2d",
          "userId": "11111111-1111-4111-8111-111111111111",
          "type": "BOOKING_CONFIRMED",
          "title": "Booking Confirmed",
          "message": "Your hotel booking has been confirmed.",
          "data": {
            "bookingId": "8b9c1d2e-3f4a-5b6c-7d8e-9f0a1b2c3d4e",
            "hotelId": "44444444-4444-4444-8444-444444444444",
            "bookingReference": "STY-202610-A1B2C3"
          },
          "isRead": false,
          "readAt": null,
          "createdAt": "2026-10-01T14:30:00.000Z"
        }
      ],
      "meta": {
        "page": 1,
        "limit": 20,
        "total": 5,
        "totalPages": 1,
        "unreadCount": 3
      }
    }
  }
  ```

### 12.2 Get Unread Notification Count
* **Endpoint:** `GET /api/v1/notifications/unread-count`
* **Access:** Authenticated Users
* **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "data": {
      "count": 3
    }
  }
  ```

### 12.3 Get Notification by ID
* **Endpoint:** `GET /api/v1/notifications/:id`
* **Access:** Authenticated Owner
* **Authorization Invariant:** Customer A cannot access Customer B's notification (`404 NOT_FOUND` IDOR defense).
* **Success Response (`200 OK`):** Returns single `NotificationResponse`.

### 12.4 Mark Notification As Read
* **Endpoint:** `PATCH /api/v1/notifications/:id/read`
* **Access:** Authenticated Owner
* **Behavior:** Idempotently sets `isRead = true` and `readAt = NOW()`.
* **Success Response (`200 OK`):** Updated `NotificationResponse` with `isRead: true` and `readAt` timestamp.
* **Error Response (`404 NOT_FOUND`):** If notification does not exist or belongs to another user.

### 12.5 Mark All Notifications As Read
* **Endpoint:** `PATCH /api/v1/notifications/read-all`
* **Access:** Authenticated Users
* **Behavior:** Atomically transitions all unread notifications for the calling user to `isRead = true`. Other users remain completely unaffected.
* **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "count": 3,
    "message": "All notifications marked as read."
  }
  ```

---

## 13. Real-Time Events API Specification (Phase 15)

### 13.1 Server-Sent Events (SSE) Stream
* **Endpoint:** `GET /api/v1/events/stream`
* **Access:** Authenticated Users (`CUSTOMER`, `HOTEL_MANAGER`, `ADMIN`)
* **Headers:**
  - `Authorization: Bearer <JWT>` (Standard HTTP header)
  - `Accept: text/event-stream`
* **Query Parameter Alternative:**
  - `?token=<JWT>` (Supported for browser `EventSource` which lacks custom header capabilities)
* **Response Content-Type:** `text/event-stream`
* **Transport Characteristics:**
  - Unidirectional HTTP persistent stream.
  - Periodic heartbeat comments/events every 30 seconds (`: heartbeat`) to maintain open socket through reverse proxies.
  - Reconnection retry hint included with every event (`retry: 5000`).
* **Event Envelope Structure:**
  ```text
  id: <event-uuid>
  event: <EVENT_TYPE>
  data: {"id":"<event-uuid>","type":"<EVENT_TYPE>","timestamp":"<ISO8601>","data":{...}}
  retry: 5000
  ```
* **Supported Event Types:**
  - `BOOKING_CREATED`
  - `BOOKING_CONFIRMED`
  - `BOOKING_CANCELLED`
  - `PAYMENT_COMPLETED`
  - `PAYMENT_FAILED`
  - `CHECKED_IN`
  - `CHECKED_OUT`
  - `NOTIFICATION_CREATED`
  - `HEARTBEAT`
* **Connection Lifecycle & Limits:**
  - Maximum 5 concurrent connections per authenticated user (`SSE_MAX_CONNECTIONS_PER_USER=5`). When exceeded, the oldest connection is gracefully closed.
  - On network disconnection, the in-memory registry automatically cleans up active listeners without leaks.
* **Client Recovery Contract:**
  - SSE is purely a notification mechanism. On reconnect or missed events, clients must query authoritative REST endpoints (`GET /api/v1/bookings/:id`, `GET /api/v1/notifications`, etc.) to reconcile current state.







