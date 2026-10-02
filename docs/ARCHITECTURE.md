# Stayora Backend — System Architecture

> **Version:** 1.0.0 (Phase 13: Redis Infrastructure)  
> **Backend Framework:** NestJS with TypeScript  
> **Database:** PostgreSQL 16 (Authoritative Source of Truth)  
> **Cache & Coordination:** Redis 7 (Non-Authoritative Ephemeral Infrastructure)  
> **Authentication:** Stateless JWT with Role-Based Access Control (RBAC)  

---

## 1. High-Level Architecture Overview

Stayora is a centralized, production-grade hotel booking platform serving three primary client interfaces:
1. **Customer Web App**: Browsing, discovery, room reservations, reviews, and booking notifications.
2. **Manager Web App**: Inventory controls, room allocation management, and hotel property maintenance.
3. **Admin Dashboard**: System-wide oversight, property creation, manager assignments, and audit logs.

```text
┌─────────────────────────┐   ┌────────────────────────┐   ┌───────────────────────┐
│    Customer Web App     │   │    Manager Web App     │   │    Admin Dashboard    │
└────────────┬────────────┘   └───────────┬────────────┘   └───────────┬───────────┘
             │                            │                            │
             └──────────────────────┐     │     ┌──────────────────────┘
                                    ▼     ▼     ▼
                          ┌────────────────────────────┐
                          │   Stayora NestJS Backend   │
                          │        (/api/v1)           │
                          └─────────────┬──────────────┘
                                        │
                 ┌──────────────────────┴──────────────────────┐
                 ▼                                             ▼
  ┌─────────────────────────────┐               ┌─────────────────────────────┐
  │   PostgreSQL 16 (Primary)   │               │       Redis 7 (Cache)       │
  │                             │               │                             │
  │ • Authoritative Entity Data │               │ • Non-Authoritative Cache   │
  │ • Pessimistic Locking       │               │ • Cache-Aside Fallback      │
  │ • GiST Exclusion Constraints│               │ • Explicit TTLs             │
  │ • ACID Transactions         │               │ • Zero Business Criticality │
  └─────────────────────────────┘               └─────────────────────────────┘
```

---

## 2. PostgreSQL as Sole Authoritative Source of Truth

PostgreSQL remains the absolute source of truth across the entire lifecycle:
* **Bookings**: Physical room allocations and availability are safeguarded by PostgreSQL GiST exclusion constraints (`exclude_overlapping_room_allocations`).
* **Payments**: Financial records, payment attempts, and refunds are serialized via database transactions and row-level locks (`SELECT ... FOR UPDATE`).
* **Inventory**: Physical rooms and room types are managed exclusively in PostgreSQL.
* **Authentication**: User accounts, password hashes, and assigned roles are stored and verified in PostgreSQL.
* **Full Recoverability**: If Redis data is completely flushed or corrupted, the system continues running without data loss.

---

## 3. Redis Infrastructure & Caching Architecture

Redis 7 serves as supporting, non-authoritative infrastructure to reduce database query load for read-heavy operations without introducing consistency risks.

### 3.1 Key Naming Convention
All Redis keys are strictly formatted according to a centralized naming convention:
```text
stayora:{environment}:{domain}:{identifier}
```
Examples:
* `stayora:development:hotel:550e8400-e29b-41d4-a716-446655440000` (Hotel details cache)
* `stayora:production:search:d41d8cd98f00b204e9800998ecf8427e` (Search result cache)
* `stayora:test:temp:session-token` (Transient coordination)

Keys are constructed exclusively through the centralized `RedisKeys` builder (`src/infrastructure/redis/redis-keys.ts`).

### 3.2 Explicit TTL Semantics
No Redis keys are persisted indefinitely without reason. Defined standard TTL tiers:
* `REDIS_TTL.SHORT`: 60 seconds (rapidly changing counters, transient tokens)
* `REDIS_TTL.MEDIUM`: 300 seconds (hotel discovery details, room type summaries)
* `REDIS_TTL.LONG`: 3600 seconds (static catalog metadata)
* `REDIS_TTL.DAY`: 86400 seconds (daily aggregated rollups)

### 3.3 Cache-Aside Pattern
Operations using Redis implement the non-blocking cache-aside pattern:
1. Attempt Redis retrieval via `redisService.get(key)`.
2. On cache hit, return deserialized JSON object.
3. On cache miss or Redis error, query PostgreSQL.
4. Asynchronously populate Redis with defined TTL.
5. Return authoritative data.

### 3.4 Cache Invalidation
When mutable resources are updated or deleted:
* `HotelsService.updateHotelForManager()` invalidates `RedisKeys.hotel(hotelId)`.
* `HotelsService.deleteHotelForManager()` evicts `RedisKeys.hotel(hotelId)`.
* Pattern-based invalidation (`deleteByPattern`) cleans matching domain keys using non-blocking Redis `SCAN`.

### 3.5 Failure Model & Graceful Degradation
* **Degraded Health**: If Redis is unreachable, `GET /api/v1/health` returns status `degraded` (`services.redis = "down"`).
* **Transparent Fallback**: Caching methods catch Redis errors, log warnings, and fall back directly to PostgreSQL without crashing customer or manager requests.
* **Corrupt Entry Handling**: Malformed or unparseable JSON values in Redis are detected, automatically evicted, and bypassed in favor of fresh PostgreSQL queries.

---

## 4. Booking Correctness Guarantee

**CRITICAL INVARIANT:** Redis cache never determines final booking availability.

```text
Customer Discovery
       ↓
Redis Cache (Advisory Discovery Data)
       ↓
Customer Selects Room & Dates
       ↓
Booking API Request
       ↓
PostgreSQL ACID Transaction
       ↓
Pessimistic Hold & GiST Exclusion Check (Authoritative)
       ↓
Booking Confirmed
```

A stale Redis cache can never lead to double bookings. The transactional booking engine in PostgreSQL always performs the definitive room availability verification and locks allocation slots.

---

## 5. Stateless JWT Authentication

JWT validation does not depend on Redis:
* Each request passes through `JwtAuthGuard`, validating signature and expiry statelessly.
* Database user state is verified via `JwtStrategy` directly against PostgreSQL.
* Redis outages do not disrupt authentication or authorize invalid tokens.
