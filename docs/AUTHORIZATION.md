# Stayora — Authorization & RBAC Architecture Specification

> **Phase 4 Technical Contract & Security Specification**  
> **Document Version:** 1.0.0-production  
> **Authority:** NestJS Backend (`http://localhost:4000/api/v1`)  
> **Target Scopes:** Role-Based Access Control (RBAC) & Multi-Tenant Resource Authorization  
> **Status:** Implemented & Verified  

---

## 1. Executive Summary & Authorization Architecture

Stayora decouples **Identity (Authentication)** from **Capability (Authorization)** and **Data Isolation (Resource Authorization)**.

```text
                               HTTP Request
                                    │
                                    ▼
                          [JwtAuthGuard]
                     (Extracts & Validates Token)
                                    │
                         Is Token Valid & Active?
                          ├── No  ──► 401 Unauthorized (INVALID_TOKEN / TOKEN_EXPIRED)
                          └── Yes
                                    ▼
                           [RolesGuard]
                   (Evaluates @Roles(...) Metadata)
                                    │
                         User Role in Metadata?
                          ├── No  ──► 403 Forbidden (FORBIDDEN)
                          └── Yes
                                    ▼
                       [Resource Authorization]
             (HotelAuthorizationService / Ownership Assertions)
                                    │
                     User Assigned to / Owns Resource?
                          ├── No  ──► 403 Forbidden (or 404 IDOR Privacy Policy)
                          └── Yes
                                    ▼
                           Business Handler
```

### Core Security Invariants:
1. **Authentication Precedes Authorization:** A request without a valid JWT is rejected with `401 Unauthorized` before role or resource checks execute.
2. **Role Is Not a Universal Key:** Possessing `HOTEL_MANAGER` grants permission to manage properties, but **only properties assigned to that manager via `hotel_managers`**.
3. **Zero Frontend Origin Trust:** Port `:3000`, `:3001`, or `:3002` headers provide zero authorization guarantees. The backend independently verifies `JWT` + `UserRole` + `Resource Assignment`.
4. **Defense in Depth (IDOR Protection):** Changing `hotelId` or resource UUIDs in HTTP request parameters cannot bypass server-side ownership assertions.

---

## 2. Role-Based Access Control (RBAC) Matrix

Stayora defines three primary operational roles in `UserRole`:

| Endpoint Domain | Description | CUSTOMER | HOTEL_MANAGER | ADMIN |
| :--- | :--- | :---: | :---: | :---: |
| `/api/v1/customer/*` | Customer discovery, bookings, personal profile, reviews | ✅ **Allowed** | ❌ **Forbidden** | ❌ **Forbidden** |
| `/api/v1/manager/*` | Hotel property operations, room catalog, inventory allocation | ❌ **Forbidden** | ✅ **Assigned Only** | ❌ **Forbidden** |
| `/api/v1/admin/*` | Platform oversight, all properties overview, user auditing | ❌ **Forbidden** | ❌ **Forbidden** | ✅ **Allowed** |

### Multi-Role Semantics (`OR` Logic)
When multiple roles are specified on an endpoint, e.g.:
```ts
@Roles(UserRole.HOTEL_MANAGER, UserRole.ADMIN)
```
Access is granted if the user possesses **ANY** of the listed roles. It does **not** require both roles simultaneously.

---

## 3. Resource-Level Authorization: `ManagerHotel`

The `HotelManager` relation (`hotel_managers` table) is the authoritative join entity binding managers to physical hotel properties:

```text
Hotel A (Mumbai)                    Hotel B (Goa)                     Hotel C (Manali)
       ▲                                   ▲                                 ▲
       │                                   │                                 │
[hotel_managers]                   [hotel_managers]                  [hotel_managers]
       │                                   │                                 │
       └─────────────────┬─────────────────┘                                 │
                         │                                                   │
                  Manager A (Vikram)                                   Manager B (Bravo)
```

### 3.1 The `HotelAuthorizationService`
Centralized service (`src/modules/hotels/authorization/hotel-authorization.service.ts`) used across all hotel mutations and queries:

```ts
await this.hotelAuthorizationService.assertManagerAccess(managerId, hotelId);
```

#### Verification Flow:
1. **Hotel Existence Check:** Verifies the hotel exists and is not soft-deleted. If non-existent $\rightarrow$ returns `404 NOT_FOUND`.
2. **Assignment Check:** Queries `prisma.hotelManager.findUnique({ where: { userId_hotelId: { userId, hotelId } } })`.
   - If present $\rightarrow$ access granted.
   - If missing $\rightarrow$ throws `403 FORBIDDEN` (`FORBIDDEN: Access denied. You are not assigned to manage this hotel property.`).

---

## 4. Insecure Direct Object Reference (IDOR) & Privilege Escalation Defenses

### 4.1 Horizontal Privilege Escalation
* **Threat:** Manager A (`manager@stayora.com`) assigns to Hotel A. Manager A intercepts or modifies a request URL to target Hotel C (`/api/v1/manager/hotels/{hotelCId}`).
* **Defense:** Even though Manager A's JWT has `role: HOTEL_MANAGER`, `HotelAuthorizationService.assertManagerAccess()` detects that no record exists in `hotel_managers` for `(Manager A, Hotel C)`.
* **Outcome:** Request is blocked with `403 FORBIDDEN` (or `404 NOT_FOUND` under strict privacy policy). No data is returned, and no update is applied.

### 4.2 Vertical Privilege Escalation
* **Threat:** A Customer attempts to call `/api/v1/manager/hotels` or `/api/v1/admin/hotels`.
* **Defense:** `RolesGuard` compares the token's role against `@Roles(UserRole.ADMIN)` or `@Roles(UserRole.HOTEL_MANAGER)`.
* **Outcome:** Blocked with `403 FORBIDDEN` (`FORBIDDEN: You do not have permission to access this resource.`).

### 4.3 Query Scoping by Assignment
Manager list endpoints (`GET /api/v1/manager/hotels`) never execute an unrestricted `findMany()`. They dynamically scope queries using:
```ts
const managedIds = await this.hotelAuthorizationService.getManagedHotelIds(managerId);
return this.prisma.hotel.findMany({ where: { id: { in: managedIds } } });
```
This guarantees that managers only ever receive records for properties they manage.

---

## 5. Status Codes: 401 vs 403 vs 404

| HTTP Status | Exception Code | Condition | Example |
| :--- | :--- | :--- | :--- |
| **`401 Unauthorized`** | `UNAUTHORIZED` / `INVALID_TOKEN` | Caller failed authentication. Missing, expired, or forged JWT. | Request sent without `Authorization: Bearer` header. |
| **`403 Forbidden`** | `FORBIDDEN` | Caller is authenticated, but lacks the necessary role or resource assignment. | Customer calling `/api/v1/admin/hotels` or Manager A editing Hotel C. |
| **`404 Not Found`** | `NOT_FOUND` | Target resource does not exist in PostgreSQL. | Querying a non-existent UUID or soft-deleted hotel. |

### Resource Existence Privacy Policy
In public or semi-trusted contexts where revealing that a resource exists constitutes an information leak, `HotelAuthorizationService` supports the `{ hideExistence: true }` option:
* Instead of returning `403 Forbidden` (which confirms the hotel ID exists in the database), the service returns `404 Not Found`.

---

## 6. Customer Resource Ownership Pattern

For customer-owned records (profiles, future bookings, and notifications), the reusable `ResourceOwnershipService` (`src/common/authorization/resource-ownership.service.ts`) enforces ownership:

```ts
this.resourceOwnershipService.assertOwnerOrAdmin(
  authenticatedUser,
  resource.customerId,
  'You do not own this reservation.'
);
```
* **Self-Service Preference:** Customer profile updates are routed through `/api/v1/auth/me` rather than `/api/v1/users/:userId`, eliminating IDOR attack vectors on personal data.

---

## 7. Admin Access Boundaries

1. **Admin Role Isolation:** Platform administrative endpoints (`/api/v1/admin/*`) are strictly guarded by `@Roles(UserRole.ADMIN)`.
2. **Explicit Administrative Permissions:** Admins are not treated as implicit entries in the `hotel_managers` table. Operational admin routes explicitly specify whether admin override is permitted using `assertAdminOrManagerAccess()`.
3. **Property Creation & Manager Assignment Governance:**
   - Property creation (`POST /api/v1/admin/hotels`) is strictly restricted to `ADMIN`.
   - Managers cannot assign properties to themselves or others. Administrative assignments (`POST /api/v1/admin/hotels/:id/managers`) explicitly bind verified `HOTEL_MANAGER` accounts to properties.
   - De-assignment (`DELETE /api/v1/admin/hotels/:id/managers/:managerId`) revokes access immediately.

---

## 8. Verification & Test Evidence

### Unit Tests
* `src/common/guards/roles.guard.spec.ts`: Tests missing roles, missing authentication, matching roles, insufficient roles, and multi-role OR evaluation.
* `src/modules/hotels/authorization/hotel-authorization.service.spec.ts`: Tests hotel existence verification, assigned manager access, unassigned manager rejection, and admin override.
* `src/modules/hotels/hotels.service.spec.ts`: Tests admin creation, public discovery filtering, manager assigned property retrieval, unassigned manager rejection, and soft-deactivation.
* `src/common/authorization/resource-ownership.service.spec.ts`: Tests customer ownership match, non-owner rejection, and admin bypass.

### E2E Security & IDOR Tests
* `test/authorization.e2e-spec.ts`:
  - **Role Invariants (401 vs 403):** Verified missing token $\rightarrow$ 401, invalid token $\rightarrow$ 401, customer on manager endpoint $\rightarrow$ 403.
  - **Vertical Escalation:** Customer $\rightarrow$ Manager (403), Customer $\rightarrow$ Admin (403), Manager $\rightarrow$ Admin (403), Admin $\rightarrow$ Admin (200).
  - **Horizontal IDOR Defense:** Manager A $\rightarrow$ Hotel A (200), Manager A $\rightarrow$ Hotel B (200), Manager A $\rightarrow$ Hotel C (403 Forbidden on GET, PATCH, and DELETE).
  - **Manager Isolation:** Manager B $\rightarrow$ Hotel C (200), Manager B $\rightarrow$ Hotel A (403 Forbidden).
  - **Query Scoping:** Manager A list query returns only assigned hotels; Hotel C is omitted.
* `test/hotels.e2e-spec.ts`:
  - **Property Lifecycle & CRUD:** Admin property creation, manager retrieval, manager update, and soft-deletion.
  - **Public Discovery & Filtering:** Unauthenticated listing with pagination (`page`, `limit`), case-insensitive city search, star rating filter, and hiding inactive/soft-deleted properties.
  - **Manager Assignment Enforcement:** Admin assigning/unassigning managers; verifying unassigned managers receive 403 on property updates and deletion.

---

## 9. Future Authorization Roadmap (Phases 5 – 10)

The following resource-level authorization services will be implemented alongside their respective business domains:
* **Phase 6 (Room Inventory):** Verify room and room-type modifications belong to a hotel assigned to the manager.
* **Phase 8 (Bookings):** Customer booking ownership assertions (`assertBookingOwner`) and manager property booking checks (`assertBookingBelongsToManagerHotel`).
* **Phase 9 (Payments & Refunds):** Restricting refund issuance to authorized property managers or platform admins.
