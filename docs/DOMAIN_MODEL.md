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
