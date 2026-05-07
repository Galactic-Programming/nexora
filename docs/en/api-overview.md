# API Overview

> 🇻🇳 Bản tiếng Việt: [`../vi/api-overview.md`](../vi/api-overview.md).

Base URL: `${API_PREFIX}` (default `/api/v1`). Swagger UI: `/api/docs` (dev only).

## Response envelope

All responses use:

```jsonc
{
  "data": <payload> | null,
  "error": null | { "code": "STRING", "message": "...", "details": ... },
  "meta": { /* pagination, optional */ }
}
```

## Error codes

| Code | HTTP | Meaning |
| --- | --- | --- |
| `BAD_REQUEST` | 400 | Validation failed (class-validator) |
| `UNAUTHORIZED` | 401 | Missing / invalid / expired JWT, or local user not synced |
| `FORBIDDEN` | 403 | Authenticated but role insufficient |
| `NOT_ADMIN` | 403 | Email not on `ADMIN_EMAILS` allowlist (admin sync only) |
| `USER_NOT_SYNCED` | 401 | JWT valid but no local DB row — call `POST /auth/sync` |
| `USER_NOT_FOUND` | 404 | User row was deleted between guard and handler |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Unique constraint violation |
| `TOO_MANY_REQUESTS` | 429 | Throttler kicked in |
| `INTERNAL_SERVER_ERROR` | 500 | Unhandled |

## Endpoint matrix

Legend: 🌍 public · 🔒 customer (any authenticated user) · 🛡 admin only.

### Sprint B0 — Health

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| GET | `/health` | 🌍 | Liveness — does not touch DB |
| GET | `/health/ready` | 🌍 | Readiness — `data.checks.database` is `up` / `down` |

### Sprint B1 — Auth & Users

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| POST | `/auth/sync` | 🔒 | Upsert the JWT-bearing user as `CUSTOMER`. Idempotent. Body fields all optional. |
| POST | `/auth/admin/sync` | 🛡 | Same upsert but elevates to `ADMIN`. Caller email must be on `ADMIN_EMAILS` allowlist; otherwise 403. |
| GET | `/users/me` | 🔒 | Return the current user's profile. |
| PATCH | `/users/me` | 🔒 | Update `fullName`, `phone`, `locale`. Email + role are immutable here. |

### How clients should use the auth endpoints

1. User signs in/up via Supabase on the frontend → receives `access_token`.
2. Frontend calls **once** `POST /auth/sync` (customer FE) or `POST /auth/admin/sync` (admin FE) to mirror the user into the local DB.
3. All subsequent protected requests carry `Authorization: Bearer <access_token>`.
4. If `GET /users/me` returns `USER_NOT_SYNCED`, the FE must replay step 2.

### Future sprints (planned)

- B2: `/destinations`, `/tours`, `/tours/:slug`, `/tours/:slug/departures`, `/admin/uploads/signed-url`
- B3: `/bookings`, `/payments/webhook`, `/admin/bookings/:id/refund`
- B4: `/reviews`, `/wishlist`, `/admin/stats`

See [`roadmap.md`](../roadmap.md) for the full per-sub-feature tracker.
