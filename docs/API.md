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

