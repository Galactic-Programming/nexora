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

### Sprint B3.1–B3.3 — Bookings (customer-facing)

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| POST | `/bookings` | 🔐 | Create PENDING booking + mint Stripe Checkout session. Returns `{ bookingId, bookingCode, checkoutUrl, status }`. |
| GET | `/bookings/me` | 🔐 | Caller's own bookings, newest first (top 50). |
| GET | `/bookings/:code` | 🔐 | One booking by code. Owner-or-admin only; non-owners see the same 404 as a truly-missing code. |

🔐 = JWT required; 401 `USER_NOT_SYNCED` if the caller hasn't run `/auth/sync` yet.

Body for `POST /bookings`:

- `tourSlug` (kebab-case, must be published)
- `departureId` (UUID, must belong to that tour AND be OPEN)
- `numAdults` (1–20), optional `numChildren` (0–20, default 0)
- `contactName`, `contactEmail`, optional `contactPhone`, optional `specialRequests`

`userId`, `currency`, `totalAmount`, `code`, and `status` are server-controlled. `seatsBooked` is mutated **only by the webhook** (Sprint B3.4) under a row lock — never on create.

Error codes:

- `TOUR_NOT_FOUND` (404) — slug missing or unpublished
- `DEPARTURE_NOT_FOUND` (404) — departure missing or not under the tour
- `DEPARTURE_NOT_OPEN` (400) — departure is CLOSED/CANCELLED
- `SEATS_NOT_AVAILABLE` (409) — best-effort capacity check (real reservation happens in webhook)
- `STRIPE_SESSION_INVALID` (400) — Stripe returned a session without a redirect URL
- `BOOKING_NOT_FOUND` (404) — also returned for non-owners (anti-enumeration)
- `USER_NOT_SYNCED` (401) — caller hasn't run `/auth/sync` yet

**Note:** Without B3.4 webhook wired up, a successful Stripe payment leaves the booking in PENDING — the FE success page will show "processing". B3.4 closes the loop.

### Sprint B3.4 — Stripe webhook

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| POST | `/payments/webhook` | 🌐 (signature-gated) | Stripe webhook receiver. Verifies signature, idempotent on `event.id`, mutates booking status under a row lock. |

Two-layer idempotency:

1. **Event-level** — every `event.id` is inserted into `payment_events` (UNIQUE). A duplicate insert returns 200 immediately without re-running side effects, so Stripe retries are safe.
2. **Booking-level** — `checkout.session.completed` handling runs inside a Prisma transaction with `SELECT seats_total, seats_booked FROM tour_departures WHERE id = $1 FOR UPDATE`. If the booking is already PAID/REFUNDED it no-ops; if seats no longer fit (race with another concurrent payment), the booking is automatically refunded and CANCELLED.

Events handled:

- `checkout.session.completed` → booking PAID, `seatsBooked += N`, `paid_at` set, `stripe_payment_intent_id` persisted.
- `checkout.session.expired` → booking CANCELLED (no seat change — we never reserved at PENDING).
- Anything else → logged + ignored. Returning 200 for unsubscribed events avoids Stripe retry noise.

Errors:

- `STRIPE_WEBHOOK_INVALID` (400) — missing or invalid `Stripe-Signature`.

Full local + production setup: [`docs/en/runbooks/stripe-testing.md`](runbooks/stripe-testing.md).

### Sprint B3.5 — Admin refund

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| POST | `/admin/bookings/:id/refund` | 🔒 ADMIN | Full Stripe refund on a PAID booking. Decrements `seatsBooked`, flips to REFUNDED, sets `cancelledAt`, fires the refund email. |

Body:

```json
{ "reason": "Tour cancelled due to weather" }
```

`reason` is optional and free-form. If it matches one of Stripe's enum values (`duplicate` / `fraudulent` / `requested_by_customer`) it's forwarded; otherwise it's persisted as Stripe metadata.

Order of operations:

1. Validate booking is PAID and has `stripePaymentIntentId`.
2. Call Stripe refund FIRST (authoritative — if Stripe rejects, the DB stays PAID).
3. In one transaction: decrement `tour_departures.seats_booked` and flip booking to REFUNDED + `cancelledAt`.
4. Fire `bookingRefunded` email (defensive — failures log-and-continue).

Errors:

- `BOOKING_NOT_FOUND` (404)
- `BOOKING_NOT_REFUNDABLE` (400) — not PAID, or missing payment_intent.
- `REFUND_FAILED` (400) — Stripe rejected (e.g. dispute window closed).

### Sprint B3.6 — Transactional email (Resend)

`EmailService` (global) wraps Resend with defensive try/catch — send failures log at WARN and never throw, so a stuck SMTP path never rolls back a PAID booking or a successful refund. Two templates ship bilingual (EN/VI) inline, selected from `user.locale`:

- `bookingConfirmation` — fired by the webhook on the PAID transition.
- `bookingRefunded` — fired by `refundByAdmin` after Stripe refund + DB commit.

Setup + production checklist: [`docs/en/runbooks/email.md`](runbooks/email.md).

### Sprint B4.1 — Customer reviews (create)

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| POST | `/reviews` | 🔒 customer | Creates a review for one of the caller's PAID bookings. |

Body: `{ bookingCode, rating (1-5), title?, body }`.

Eligibility: booking must be PAID, owned by the caller, and not already reviewed (`Review.bookingId` UNIQUE). New rows default to `isApproved=false` and aren't visible publicly until an admin flips the flag (B4.3).

Errors:

- `BOOKING_NOT_FOUND` (404)
- `BOOKING_FORBIDDEN` (403) — caller does not own the booking.
- `REVIEW_NOT_ELIGIBLE` (400) — booking is not PAID.
- `REVIEW_ALREADY_EXISTS` (409) — booking already has a review.

### Sprint B4.2 — Public review list

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| GET | `/tours/:slug/reviews` | 🌐 public | Paginated approved reviews for one tour. |

Query: `?page=1&limit=10` (max 50). Sort fixed to newest-first.

Response body strips PII — only `reviewer.fullName` is exposed, never email, phone, userId, or bookingId. `meta.averageRating` is computed across **all** approved reviews (not just the current page), suitable for the FE tour card.

Errors:

- `TOUR_NOT_FOUND` (404) — slug missing or tour unpublished.

### Sprint B4.3 — Admin moderation

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| PATCH | `/admin/reviews/:id` | 🔒 ADMIN | Toggle `isApproved` on a single review. |

Body: `{ "isApproved": true | false }`.

Idempotent — flipping a row to its current value is a no-op write. The boolean shape (vs. separate approve/reject endpoints) lets an admin re-draft a previously-published review if it gets flagged later.

Errors:

- `REVIEW_NOT_FOUND` (404)

### Sprint B4.4 — Wishlist

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| POST | `/wishlist/:tourId` | 🔒 customer | Add a tour. Idempotent upsert. |
| DELETE | `/wishlist/:tourId` | 🔒 customer | Remove a tour. Idempotent. |
| GET | `/wishlist/me` | 🔒 customer | Caller's list newest-first, with tour preview joined. |

Schema: composite-PK `(userId, tourId)`. The marketing preview joined into `GET /me` includes slug, both titles, summaries, hero image, basePrice, currency, and durationDays — enough for a card without a second fetch.

Errors:

- `TOUR_NOT_FOUND` (404) on add when the tour id is unknown or unpublished.

### Sprint B4.5 — Admin dashboard stats

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| GET | `/admin/stats` | 🔒 ADMIN | Aggregated dashboard payload — overview + status breakdown + 3 top-N lists + 6-month trend. |

Response shape:

```jsonc
{
  "overview": {
    "totalRevenue": "450",       // PAID-only sum, Decimal as string
    "currency": "USD",
    "totalBookings": 5,
    "paidBookings": 3,
    "conversionRate": 0.6,        // paidBookings / totalBookings
    "monthOverMonthGrowth": 0.5   // null if there's no prior-month data
  },
  "bookingsByStatus": { "PENDING": 1, "PAID": 3, "CANCELLED": 0, "REFUNDED": 1 },
  "topToursByRevenue": [{ "tourId", "slug", "titleEn", "revenue", "bookingsCount" }],
  "topToursByRating":  [{ "tourId", "slug", "titleEn", "averageRating", "reviewsCount" }],
  "topToursByWishlist":[{ "tourId", "slug", "titleEn", "wishlistCount" }],
  "monthlyTrend":      [{ "month": "2026-05", "bookings": 4, "revenue": "150" }]
}
```

Implementation: all slices fire in parallel via `Promise.all`. Most use Prisma `groupBy`/`aggregate` (indexed: `bookings(status, createdAt)`, `reviews(tourId, isApproved)`). The monthly bucket uses `$queryRaw` with `date_trunc('month', ...)` because Prisma's typed API doesn't expose it.

Currency note: aggregates raw `totalAmount` without FX conversion — fine for the USD-only thesis seed; revisit if multi-currency lands.

### Sprint B4 complete

Reviews + Wishlist + Admin stats — all 5 sub-features shipped.

### Sprint B4.6 — planned (pre-FE alignment)

Schema + service tweaks so the FE template can wire 1:1 to the Figma design. Sub-features below; full rationale in [`sprints/b4.6-figma-alignment.md`](sprints/b4.6-figma-alignment.md).

| Change | Surface |
| --- | --- |
| `Tour.isFeatured` boolean | Schema; drives home "Trending" strip |
| Extend `TourCategory` with `HONEYMOON`, `MUSICAL` | Schema; drives Services dropdown |
| `?featured=true` + `sort=createdDesc\|priceAsc\|priceDesc\|titleAsc\|titleDesc` | `GET /tours` query DTO |
| `averageRating`, `reviewsCount`, `peopleGoing` per card | `GET /tours` response payload |
| `isFeatured?` on Create/Update DTOs | `POST/PATCH /admin/tours` |

Out of scope (see [`BACKLOG.md`](../BACKLOG.md)): Build Your Own Package custom builder, newsletter subscribe, multi-currency revenue.

### Sprint B5 — on hold

Hardening + Railway deploy. Paused until the customer FE + admin FE both land, so we deploy a complete system once instead of redeploying the BE every time the FE finds a gap. See `sprints/b4.6-figma-alignment.md` § "Why pause B5".

See [`roadmap.md`](../roadmap.md) for the full per-sub-feature tracker.
