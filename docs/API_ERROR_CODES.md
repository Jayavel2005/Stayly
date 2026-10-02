# Stayora — API Error Code Catalog

> **Standard Error Contract Reference**  
> **Base URL:** `http://localhost:4000/api/v1`  
> **Specification Version:** 1.0.0  
> **Applicable Frontends:** Customer Web (`:3000`), Manager Web (`:3001`), Admin Dashboard (`:3002`)

All client applications consuming the Stayora backend must rely on machine-readable `error.code` strings rather than parsing human-readable error messages.

---

## 1. Standard Error Envelope

Every HTTP error response emitted by the Stayora API adheres to the following unified JSON contract:

```json
{
  "success": false,
  "error": {
    "code": "ROOM_NOT_AVAILABLE",
    "message": "The selected room category does not have enough available physical rooms for the specified dates.",
    "details": [
      "No physical rooms of type Deluxe Suite available between 2026-10-10 and 2026-10-12"
    ]
  },
  "timestamp": "2026-10-02T12:00:00.000Z",
  "path": "/api/v1/bookings"
}
```

### Envelope Fields:
* `success`: Always `false` on non-2xx status codes.
* `error.code`: A stable, uppercase, underscore-separated machine-readable error identifier from the catalog below.
* `error.message`: A clear, human-readable description intended for logging or developer diagnosis.
* `error.details`: (Optional) An array of detailed validation failures or field-level constraints.
* `timestamp`: ISO 8601 UTC timestamp of when the error occurred.
* `path`: Request URI path that generated the exception.

---

## 2. Authentication & Authorization Errors

| HTTP Status | Error Code | Description / Trigger Scenario | Client Remediation |
| :--- | :--- | :--- | :--- |
| `401 Unauthorized` | `UNAUTHORIZED` | Bearer token is missing, expired, invalid, or malformed in `Authorization` header. | Redirect user to relevant login portal; refresh token if available. |
| `401 Unauthorized` | `AUTH_INVALID_CREDENTIALS` | Incorrect email or password entered during customer, manager, or admin login. | Prompt user to verify credentials. |
| `403 Forbidden` | `AUTH_ACCOUNT_DISABLED` | Account has been deactivated or disabled by an administrator. | Inform user their account has been disabled. |
| `403 Forbidden` | `AUTH_ACCOUNT_SUSPENDED` | Account has been temporarily suspended due to security or policy violations. | Display suspension notice. |
| `403 Forbidden` | `AUTH_ROLE_MISMATCH` | Authenticated user role is incompatible with target portal (e.g. customer attempting manager portal). | Direct user to their authorized portal. |
| `409 Conflict` | `AUTH_EMAIL_EXISTS` | Registration attempted with an email address that is already registered. | Prompt user to log in or use password recovery. |
| `403 Forbidden` | `FORBIDDEN` | Authenticated user lacks required RBAC role or resource-level tenancy ownership. | Display unauthorized access banner. |

---

## 3. Request Validation & General Errors

| HTTP Status | Error Code | Description / Trigger Scenario | Client Remediation |
| :--- | :--- | :--- | :--- |
| `400 Bad Request` | `VALIDATION_ERROR` | Request payload failed `class-validator` rules or contained non-whitelisted fields. | Inspect `error.details` for field-specific validation failures. |
| `400 Bad Request` | `BAD_REQUEST` | Malformed URL parameters, invalid UUIDs, or improper query types. | Correct query parameters and URL syntax. |
| `404 Not Found` | `NOT_FOUND` | Route does not exist or requested REST entity is not present. | Verify endpoint path and version prefix (`/api/v1`). |
| `409 Conflict` | `CONFLICT` | Resource state conflict or unique database constraint violation. | Re-fetch latest entity state and retry. |
| `422 Unprocessable` | `UNPROCESSABLE_ENTITY` | Well-formed syntax that violates domain validation rules. | Correct domain parameters. |
| `429 Too Many Req` | `TOO_MANY_REQUESTS` | Rate limits exceeded. | Back off and retry after delay. |
| `500 Internal Error` | `INTERNAL_SERVER_ERROR` | Unhandled backend exception. Sensitive database/stack traces are never exposed. | Retry after delay or report issue. |

---

## 4. Hotels & Property Catalog Errors

| HTTP Status | Error Code | Description / Trigger Scenario | Client Remediation |
| :--- | :--- | :--- | :--- |
| `404 Not Found` | `HOTEL_NOT_FOUND` | Hotel property with the specified UUID does not exist or has been soft-deleted. | Verify hotel ID. |
| `409 Conflict` | `HOTEL_ALREADY_EXISTS` | Hotel with the specified name or slug already exists. | Choose a unique property name/slug. |
| `403 Forbidden` | `HOTEL_INACTIVE` | Operations attempted on an inactive or deactivated hotel property. | Contact administration. |
| `403 Forbidden` | `HOTEL_ACCESS_DENIED` | Manager attempted access to a hotel property not assigned to them in `hotel_managers`. | Verify property assignment. |

---

## 5. Room Categories & Inventory Errors

| HTTP Status | Error Code | Description / Trigger Scenario | Client Remediation |
| :--- | :--- | :--- | :--- |
| `404 Not Found` | `ROOM_TYPE_NOT_FOUND` | Room category (RoomType) with specified UUID does not exist or is inactive. | Verify room type ID. |
| `409 Conflict` | `ROOM_TYPE_ALREADY_EXISTS`| Category name or slug collision within the parent hotel. | Select a distinct category name. |
| `409 Conflict` | `ROOM_TYPE_HAS_ACTIVE_ROOMS`| Soft-deletion blocked because active physical rooms are still mapped to this category. | Reassign or deactivate physical rooms first. |
| `404 Not Found` | `ROOM_NOT_FOUND` | Physical room with specified UUID does not exist. | Verify room ID. |
| `409 Conflict` | `ROOM_NUMBER_ALREADY_EXISTS`| Room number (e.g. "101") already exists in this hotel property. | Use unique room number within hotel. |
| `400 Bad Request` | `ROOM_STATUS_INVALID` | Invalid operational readiness status (must be `AVAILABLE`, `MAINTENANCE`, `OUT_OF_SERVICE`). | Provide valid enum value. |
| `409 Conflict` | `ROOM_NOT_AVAILABLE` | No operational physical rooms available for the requested room type and date range `[checkIn, checkOut)`. | Prompt user to select alternate dates or categories. |

---

## 6. Search & Availability Errors

| HTTP Status | Error Code | Description / Trigger Scenario | Client Remediation |
| :--- | :--- | :--- | :--- |
| `400 Bad Request` | `INVALID_DATE_RANGE` | Booking date range is invalid (e.g. checkOut earlier than or equal to checkIn). | Ensure `checkOut > checkIn`. |
| `400 Bad Request` | `CHECKOUT_BEFORE_CHECKIN` | `checkOutDate` occurs on or before `checkInDate`. | Correct date sequence. |
| `400 Bad Request` | `PAST_DATE_NOT_ALLOWED` | `checkInDate` is in the past (before today's UTC date). | Select future or current dates. |

---

## 7. Reservations & Booking Lifecycle Errors

| HTTP Status | Error Code | Description / Trigger Scenario | Client Remediation |
| :--- | :--- | :--- | :--- |
| `404 Not Found` | `BOOKING_NOT_FOUND` | Reservation with the specified UUID does not exist or access was denied (IDOR protection). | Verify booking ID or user ownership. |
| `400 Bad Request` | `BOOKING_ALREADY_CANCELLED`| Cancellation attempted on a reservation that is already `CANCELLED`. | Safe no-op; show cancelled status. |
| `400 Bad Request` | `BOOKING_NOT_CANCELLABLE` | Cancellation attempted on `CHECKED_IN`, `CHECKED_OUT`, or past reservation. | Contact hotel staff. |
| `400 Bad Request` | `BOOKING_INVALID_STATE` | Lifecycle transition does not follow the state machine (`PENDING -> CONFIRMED -> CHECKED_IN -> CHECKED_OUT`). | Review current status. |
| `400 Bad Request` | `BOOKING_NOT_CHECK_IN_ELIGIBLE`| Check-in attempted for a reservation that is not `CONFIRMED`. | Complete payment first. |
| `400 Bad Request` | `BOOKING_NOT_CHECK_OUT_ELIGIBLE`| Check-out attempted for a reservation that is not `CHECKED_IN`. | Check in guest first. |
| `409 Conflict` | `BOOKING_EXPIRED` | Reservation hold window (15 minutes) expired before payment completion. | Re-create reservation. |

---

## 8. Payments & Idempotency Errors

| HTTP Status | Error Code | Description / Trigger Scenario | Client Remediation |
| :--- | :--- | :--- | :--- |
| `404 Not Found` | `PAYMENT_NOT_FOUND` | Payment record does not exist. | Verify payment ID. |
| `400 Bad Request` | `PAYMENT_NOT_PAYABLE` | Booking is not in `PENDING` status or is already expired/cancelled. | Check booking state. |
| `409 Conflict` | `PAYMENT_ALREADY_COMPLETED`| Payment was already settled for this reservation. | Direct customer to confirmed booking. |
| `409 Conflict` | `IDEMPOTENCY_CONFLICT` | Same `Idempotency-Key` submitted for a different booking or with conflicting parameters. | Generate a fresh UUID v4 key for distinct operations. |
| `409 Conflict` | `PAYMENT_IN_PROGRESS` | Another payment attempt is currently settling for this reservation. | Await response or poll status. |
| `402 Payment Req` | `PAYMENT_FAILED` | Gateway transaction declined or insufficient mock funds. | Prompt customer to retry payment. |

---

## 9. Reviews & Social Proof Errors

| HTTP Status | Error Code | Description / Trigger Scenario | Client Remediation |
| :--- | :--- | :--- | :--- |
| `404 Not Found` | `REVIEW_NOT_FOUND` | Review record does not exist. | Verify review ID. |
| `409 Conflict` | `REVIEW_ALREADY_EXISTS` | A review has already been submitted for this booking (`one-review-per-booking` invariant). | Allow editing existing review instead of creating new. |
| `400 Bad Request` | `REVIEW_NOT_ELIGIBLE` | Guest has not completed stay (status is not `CHECKED_OUT`). | Guest can only review after check-out. |
| `403 Forbidden` | `REVIEW_NOT_OWNED` | Caller does not own the booking or review being modified. | IDOR blocked; verify ownership. |
| `400 Bad Request` | `REVIEW_RATING_OUT_OF_RANGE`| Rating is not an integer between 1 and 5. | Submit rating in range [1, 5]. |

---

## 10. Platform Administration & Audit Errors

| HTTP Status | Error Code | Description / Trigger Scenario | Client Remediation |
| :--- | :--- | :--- | :--- |
| `404 Not Found` | `USER_NOT_FOUND` | User account with specified UUID does not exist. | Verify user ID. |
| `403 Forbidden` | `ADMIN_SELF_PROTECTION` | Administrator attempted to deactivate or demote their own account. | Operation blocked to prevent lockout. |
| `404 Not Found` | `MANAGER_NOT_FOUND` | Hotel manager user record not found. | Verify manager ID. |
| `404 Not Found` | `MANAGER_ASSIGNMENT_NOT_FOUND`| Specified manager is not assigned to the hotel property. | Verify assignment. |
| `404 Not Found` | `AUDIT_LOG_NOT_FOUND` | Audit log record with specified UUID does not exist. | Verify audit log ID. |
| `404 Not Found` | `NOTIFICATION_NOT_FOUND`| In-app notification not found or access denied. | Verify notification ID. |
