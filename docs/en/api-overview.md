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
| `DESTINATION_NOT_FOUND` | 404 | Destination slug missing or inactive |
| `TOUR_NOT_FOUND` | 404 | Tour slug missing |
| `INVALID_DESTINATION` | 400 | Tour create/update referenced a non-existent `destinationId` |
| `CONFLICT` | 409 | Unique constraint violation |
| `DESTINATION_SLUG_EXISTS` | 409 | Slug is already in use |
| `DESTINATION_HAS_TOURS` | 409 | Cannot delete a destination that has tours |
| `TOUR_SLUG_EXISTS` | 409 | Tour slug is already in use |
| `TOUR_HAS_BOOKINGS` | 409 | Cannot delete a tour that has bookings |
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

### Sprint B2.1 — Destinations

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| GET | `/destinations` | 🌍 | List active destinations (paginated). Supports `page`, `pageSize` (max 100), `search` (en+vi name, case-insensitive), `sortBy`, `sortOrder`. |
| GET | `/destinations/:slug` | 🌍 | Single active destination by slug. 404 when missing or inactive. |
| GET | `/admin/destinations` | 🛡 | Admin list — sees inactive drafts; honours `isActive` query param. |
| GET | `/admin/destinations/:slug` | 🛡 | Admin detail — no `isActive` filter. |
| POST | `/admin/destinations` | 🛡 | Create a destination. 409 `DESTINATION_SLUG_EXISTS` on duplicate. |
| PATCH | `/admin/destinations/:slug` | 🛡 | Partial update. Renaming via `slug` works but breaks external bookmarks. |
| DELETE | `/admin/destinations/:slug` | 🛡 | Hard delete. 409 `DESTINATION_HAS_TOURS` when referencing tours exist. |

Slug rule: `^[a-z0-9]+(?:-[a-z0-9]+)*$` (kebab-case, 2–80 chars).

### Sprint B2.2 — Tours (Admin CRUD)

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| GET | `/admin/tours/:slug` | 🛡 | Detail with parent `destination` joined. 404 when slug missing. |
| POST | `/admin/tours` | 🛡 | Create. 400 `INVALID_DESTINATION` if `destinationId` is unknown; 409 `TOUR_SLUG_EXISTS` on duplicate slug. |
| PATCH | `/admin/tours/:slug` | 🛡 | Partial update. Sending `destinationId` re-validates the FK. |
| DELETE | `/admin/tours/:slug` | 🛡 | Hard delete. 409 `TOUR_HAS_BOOKINGS` when bookings reference the tour. |

Tour slug rule: same kebab-case as destinations but max 120 chars.

Public list/detail (`GET /tours`, `GET /tours/:slug`) ship in Sprint B2.3; itinerary nested CRUD in B2.4; departures + uploads in B2.5–B2.6.

### Future sprints (planned)

- B2.3: public `/tours` list + detail (filter, sort, pagination)
- B2.4: `/admin/tours/:slug/itinerary` (TourItineraryDay nested CRUD)
- B2.5–B2.6: `/admin/tours/:slug/departures`, `/admin/uploads/signed-url`
- B3: `/bookings`, `/payments/webhook`, `/admin/bookings/:id/refund`
- B4: `/reviews`, `/wishlist`, `/admin/stats`

See [`roadmap.md`](../roadmap.md) for the full per-sub-feature tracker.
