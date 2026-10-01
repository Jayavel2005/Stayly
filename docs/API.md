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
