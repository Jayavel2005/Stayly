# Stayora — Authentication Architecture Specification

> **Phase 3 Technical Contract & Security Specification**  
> **Document Version:** 1.0.0-production  
> **Authority:** Centralized NestJS Backend (`http://localhost:4000/api/v1/auth`)  
> **Target Clients:** Customer Web (`:3000`), Manager Web (`:3001`), Admin Web (`:3002`)  
> **Status:** Implemented & Verified  

---

## 1. Executive Summary & Three-Application Architecture

Stayora adopts a **centralized authentication authority** serving three completely independent frontend clients:

```text
Customer Web (:3000)      Manager Web (:3001)       Admin Web (:3002)
   [Customer Portal]         [Property Portal]        [Platform Admin]
           │                         │                       │
           ▼                         ▼                       ▼
  POST /auth/customer/login  POST /auth/manager/login  POST /auth/admin/login
  POST /auth/customer/register
           │                         │                       │
           └─────────────────────────┼───────────────────────┘
                                     ▼
                     Stayora Central Auth Module (NestJS)
                                     │
                        ┌────────────┴────────────┐
                        ▼                         ▼
                 AuthService + JWT        PostgreSQL 16 Engine
                 (bcrypt 10 rounds)        ("users" table)
```

### Core Architecture Invariants:
1. **Single Source of Truth:** 1 User model, 1 PostgreSQL database, 1 NestJS backend auth engine.
2. **Discrete Client Entry Points:** Application-specific login endpoints prevent cross-portal account confusion.
3. **Zero Frontend Trust:** Frontend origin/port is never treated as authorization. Authentication requires a cryptographically verified JWT matching an active database record.
4. **No Privilege Escalation:** Public registration is strictly confined to `CUSTOMER`. Manager and Admin accounts can only be provisioned through controlled backend mechanisms.

---

## 2. Cross-Application Authentication & Portals

| Portal | Port | Target Audience | Allowed Roles | Registration Policy |
| :--- | :--- | :--- | :--- | :--- |
| **Customer Web** | `:3000` | Guests & Travelers | `CUSTOMER` | **Public Registration Allowed** |
| **Manager Web** | `:3001` | Hotel & Property Staff | `HOTEL_MANAGER` | **No Public Signup** (Seed / Provisioned) |
| **Admin Web** | `:3002` | Platform Administrators | `ADMIN` | **No Public Signup** (Seed / Provisioned) |

### Cross-Portal Login Isolation Matrix
To preserve strict separation of concerns across the three user experiences:

| User Role | Customer Login (`/customer/login`) | Manager Login (`/manager/login`) | Admin Login (`/admin/login`) |
| :--- | :---: | :---: | :---: |
| **CUSTOMER** | ✅ **200 OK** | ❌ **403 Forbidden** (`INVALID_APPLICATION_ROLE`) | ❌ **403 Forbidden** (`INVALID_APPLICATION_ROLE`) |
| **HOTEL_MANAGER** | ❌ **403 Forbidden** (`INVALID_APPLICATION_ROLE`) | ✅ **200 OK** | ❌ **403 Forbidden** (`INVALID_APPLICATION_ROLE`) |
| **ADMIN** | ❌ **403 Forbidden** (`INVALID_APPLICATION_ROLE`) | ❌ **403 Forbidden** (`INVALID_APPLICATION_ROLE`) | ✅ **200 OK** |

---

## 3. API Endpoints Specification

Base Path: `/api/v1/auth`

### 3.1 Customer Registration
* **Endpoint:** `POST /api/v1/auth/customer/register`
* **Access:** Public
* **Payload:**
  ```json
  {
    "email": "aarav.sharma@example.com",
    "password": "StrongPassword123!",
    "name": "Aarav Sharma",
    "phone": "+919876543210"
  }
  ```
* **Behaviors:**
  - Validates email format, trims and converts to lowercase.
  - Automatically splits `name` into `firstName` and `lastName` (or accepts `firstName` / `lastName` directly).
  - Hashes password using `bcrypt` (10 rounds).
  - Explicitly sets `role: CUSTOMER` and `status: ACTIVE`.
  - Rejects duplicate emails with `409 Conflict` (`EMAIL_ALREADY_REGISTERED`).
  - Strict whitelisting forbids non-whitelisted fields (e.g., submitting `"role": "ADMIN"` triggers `400 VALIDATION_ERROR`).

### 3.2 Customer Login
* **Endpoint:** `POST /api/v1/auth/customer/login`
* **Access:** Public
* **Payload:**
  ```json
  {
    "email": "customer@stayora.com",
    "password": "Password123!"
  }
  ```
* **Success (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "user": {
        "id": "11111111-1111-4111-8111-111111111111",
        "email": "customer@stayora.com",
        "firstName": "Aarav",
        "lastName": "Sharma",
        "phone": "+919876543210",
        "role": "CUSTOMER",
        "status": "ACTIVE",
        "createdAt": "2026-10-01T12:00:00.000Z"
      },
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expiresIn": "15m"
    }
  }
  ```

### 3.3 Manager Login
* **Endpoint:** `POST /api/v1/auth/manager/login`
* **Access:** Public
* **Restrictions:** Rejects any account whose role is not `HOTEL_MANAGER`.

### 3.4 Admin Login
* **Endpoint:** `POST /api/v1/auth/admin/login`
* **Access:** Public
* **Restrictions:** Rejects any account whose role is not `ADMIN`.

### 3.5 Current User Profile
* **Endpoint:** `GET /api/v1/auth/me`
* **Access:** Authenticated (`Authorization: Bearer <JWT>`)
* **Behavior:** Extracts `sub` claim, queries database for active record, verifies user status, and returns sanitized profile.

### 3.6 Logout
* **Endpoint:** `POST /api/v1/auth/logout`
* **Access:** Public / Authenticated
* **Behavior:** Acknowledges stateless token disposal contract.

---

## 4. Security Architecture & Invariants

### 4.1 Password Hashing Strategy
* **Algorithm:** `bcrypt` with work factor 10.
* **Rationale:**
  1. Proven resilience against rainbow tables through cryptographically strong per-user salting.
  2. Native C acceleration through `bcrypt` node module, ensuring fast verification without event-loop bottlenecks.
  3. Pre-established in Phase 2 seed data pipeline.
* **Credential Hygiene:** API outputs and DTOs never expose `password`, `passwordHash`, or token secrets.

### 4.2 JWT Claims & Expiration
* **Header:** `typ: JWT`, `alg: HS256`
* **Payload Claims:**
  ```json
  {
    "sub": "user-uuid-v4",
    "email": "user@example.com",
    "role": "CUSTOMER",
    "iat": 1727800000,
    "exp": 1727800900
  }
  ```
* **Lifespan:** Short-lived access token (`15m` default), reducing replay window in case of token leakage.
* **Secret Configuration:** Loaded dynamically from environment (`JWT_SECRET`) through NestJS `ConfigService`.

### 4.3 Authoritative Database State Over Token Claims
A common architectural flaw in stateless JWT systems is trusting cached claims when account status changes.
Stayora enforces **Database State Authority**:
* `JwtStrategy` validates signature and expiration.
* It immediately verifies user existence and status against the PostgreSQL `users` table:
  - If user is soft-deleted (`deletedAt !== null`) $\rightarrow$ `403 ACCOUNT_DEACTIVATED`.
  - If user is suspended (`status === 'SUSPENDED'`) $\rightarrow$ `403 ACCOUNT_SUSPENDED`.
* **Even if a compromised or previously issued JWT claims `status = ACTIVE`, the database state always wins.**

### 4.4 User Enumeration Defense
Login endpoints return identical generic error messages for non-existent users and bad passwords:
```json
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid email or password."
  },
  "timestamp": "2026-10-01T13:00:00.000Z",
  "path": "/api/v1/auth/customer/login"
}
```
This prevents attackers from enumerating valid customer, manager, or admin email addresses.

---

## 5. Development Seed Accounts

For local development and testing, use the deterministic accounts provisioned by `prisma/seed.ts`:

| Portal | Email | Password | Role | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Customer Web** | `customer@stayora.com` | `Password123!` | `CUSTOMER` | `ACTIVE` |
| **Manager Web** | `manager@stayora.com` | `Password123!` | `HOTEL_MANAGER` | `ACTIVE` |
| **Admin Web** | `admin@stayora.com` | `Password123!` | `ADMIN` | `ACTIVE` |

---

## 6. Future Security Roadmap (Phase 4 & Later)

1. **Phase 4 (RBAC & Resource-Level Authorization):** Role guards (`@Roles(UserRole.ADMIN)`), property assignment checks (`HotelManager` ownership checks for manager route actions).
2. **Phase 10 (Redis & Rate Limiting):** Distributed brute-force throttling (`10 attempts / 5 min`) per IP/account via Redis sliding window counters.
3. **Future (Refresh Token Rotation):** Stored SHA-256 hashed refresh tokens in the `refresh_tokens` table with one-time rotation and device binding.
