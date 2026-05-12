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

### Sprint B2.3 — Tours (Public catalog)

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| GET | `/tours` | 🌐 | Paginated list of `isPublished = true` tours. Filters + sort below. |
| GET | `/tours/:slug` | 🌐 | Single published tour with destination joined. 404 conflates "missing" with "unpublished" so draft slugs are not probeable. |

Filters (all optional, AND-combined):

- `destination` — destination slug (kebab-case). Slug that does not resolve → empty result (not 404).
- `category` — `DAY` | `PACKAGE` | `CUSTOM`
- `minPrice` / `maxPrice` — inclusive bounds on `basePrice`
- `duration` — exact day count
- `featured` — boolean, useful for home-page hero
- `q` — free-text substring search (case-insensitive) over `titleEn`, `titleVi`, `summaryEn`, `summaryVi`

Sort whitelist: `createdAt` (default) | `basePrice` | `durationDays` | `titleEn`. `sortOrder`: `asc` | `desc`.

Pagination: `page` (default 1), `pageSize` (default 20, max 100). Response includes `meta: { page, pageSize, total, totalPages }`.

Drafts never leak: both endpoints pin `isPublished: true` server-side regardless of caller.

### Sprint B2.4 — Tours itinerary (Admin nested CRUD)

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| GET | `/admin/tours/:slug/itinerary` | 🛡 | List every day, sorted ascending by `dayNumber`. |
| POST | `/admin/tours/:slug/itinerary` | 🛡 | Create one day. 409 `ITINERARY_DAY_EXISTS` when `(tourId, dayNumber)` collides. |
| PATCH | `/admin/tours/:slug/itinerary/:dayNumber` | 🛡 | Partial update; sending `dayNumber` renumbers the row (subject to the same uniqueness rule). |
| DELETE | `/admin/tours/:slug/itinerary/:dayNumber` | 🛡 | Remove one day. Returns 200 + echo. |

Days are addressed by `(tourSlug, dayNumber)` rather than UUID — URLs read naturally and `(tourId, dayNumber)` is already unique at the DB level.

Error codes for the itinerary surface:

- `TOUR_NOT_FOUND` (404) — parent slug missing
- `ITINERARY_DAY_NOT_FOUND` (404) — day missing under the parent tour
- `ITINERARY_DAY_EXISTS` (409) — `dayNumber` collision on create OR renumber

`GET /tours/:slug` (public) now includes `itinerary` sorted ascending so the FE can render Day 1 → N without a client-side sort.

### Sprint B2.5 — Tour Departures (Admin CRUD + Public list)

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| GET | `/tours/:slug/departures` | 🌐 | Public list. Defaults: `from = today`, `status = OPEN`. 404 conflates missing/unpublished. |
| GET | `/admin/tours/:slug/departures` | 🛡 | Admin list — full history including CLOSED/CANCELLED. No implicit defaults. |
| POST | `/admin/tours/:slug/departures` | 🛡 | Create one departure. |
| PATCH | `/admin/tours/:slug/departures/:id` | 🛡 | Partial update. Capacity guard: `seatsTotal >= seatsBooked`. |
| DELETE | `/admin/tours/:slug/departures/:id` | 🛡 | Hard delete. Pre-checks `seatsBooked === 0`. |

Query params for both list endpoints: `from` (ISO 8601 date, inclusive), `to` (inclusive upper bound), `status` (`OPEN | CLOSED | CANCELLED`).

`seatsBooked` is **never** accepted from clients — it's mutated only by the booking flow (Sprint B3) under transaction + row lock.

Error codes:

- `TOUR_NOT_FOUND` (404) — parent slug missing OR (public) unpublished
- `DEPARTURE_NOT_FOUND` (404) — departure id missing under the parent tour
- `INVALID_DATE_RANGE` (400) — `endDate < startDate` (revalidated when patching only one of the two)
- `SEATS_TOTAL_BELOW_BOOKED` (400) — update would drop capacity below seats already sold
- `DEPARTURE_HAS_BOOKINGS` (409) — delete refused because seats are sold (or P2003 race fallback)

### Sprint B2.6 — Uploads (Signed URL admin)

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| POST | `/admin/uploads/signed-url` | 🛡 | Mint a Supabase Storage signed upload URL. FE then PUTs the file directly to Supabase — Nest never touches the bytes. |

Request body: `{ purpose, filename, contentType? }`. `purpose` enum maps to a folder under the bucket:

| Purpose | Folder |
| --- | --- |
| `TOUR_HERO` | `tours/hero/` |
| `TOUR_GALLERY` | `tours/gallery/` |
| `DESTINATION_HERO` | `destinations/hero/` |
| `USER_AVATAR` | `users/avatars/` |

Response: `{ uploadUrl, token, path, bucket }`. Path follows `<folder>/<unix-ms>-<sanitized-stem>.<ext>` to guarantee uniqueness.

Errors:

- `400 VALIDATION_ERROR` — DTO rejected the request (bad purpose / filename / contentType)
- `502 STORAGE_SIGN_FAILED` — Supabase Storage rejected the sign request (bucket missing, project paused, service role key wrong)

Full flow + bucket setup: [`docs/en/runbooks/uploads.md`](runbooks/uploads.md).

### Sprint B2.7 — Seed script

Not an HTTP surface — `pnpm db:seed` populates a realistic catalog: 4 destinations, 10 tours (9 published + 1 draft), 2 itinerary days, 30 departures spread at +30 / +75 / +150 days from "today".

Full reference: [`docs/en/runbooks/seed.md`](runbooks/seed.md).

### Future sprints (planned)

- B2.5–B2.6: `/admin/tours/:slug/departures`, `/admin/uploads/signed-url`
- B3: `/bookings`, `/payments/webhook`, `/admin/bookings/:id/refund`
- B4: `/reviews`, `/wishlist`, `/admin/stats`

See [`roadmap.md`](../roadmap.md) for the full per-sub-feature tracker.
