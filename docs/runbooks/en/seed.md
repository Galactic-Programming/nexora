# Runbook — Database seed

> 🇻🇳 Bản tiếng Việt: [`../vi/seed.md`](../vi/seed.md).

Populates the Supabase Postgres with a realistic catalog (4 destinations, 10 tours, 30 departures, 2 itinerary days) for local development, Postman runs, and demo screenshots.

## Run it

```bash
pnpm db:seed
```

That's the alias for `pnpm prisma db seed`, which Prisma 7 picks up from `prisma.config.ts` (`migrations.seed` field). It uses `ts-node --transpile-only` so you don't need to compile the seed file first.

Expected output:

```text
[seed] connecting to DB...
[seed] upserting 4 destinations...
[seed] upserting 10 tours...
[seed] resetting departures for 10 tours, inserting 30 new rows...
[seed] done.
```

Targets the database pointed at by `DIRECT_URL` (Supabase direct connection, port 5432). Falls back to `DATABASE_URL` (Supavisor pooler) if `DIRECT_URL` is unset.

## What gets created

| Entity | Count | Notes |
| --- | --- | --- |
| Destination | 4 | Hoi An, Hanoi, Sapa, Phu Quoc (all `isActive=true`) |
| Tour | 10 | 9 published + 1 draft (`hoi-an-cooking-class`, `isPublished=false`) so the public-catalog filters can be smoke-tested |
| TourItineraryDay | 2 | Day 1 + Day 2 of `sa-pa-trek-2d1n` to exercise the nested CRUD surface |
| TourDeparture | 30 | 3 per tour spread at +30d / +75d / +150d from today; `seatsTotal = ceil(maxGroupSize * 0.6)` to leave headroom for Postman bookings (B3) |

Slug for the draft tour: `hoi-an-cooking-class`. It MUST NOT show up in `GET /tours` and MUST show up in `GET /admin/tours/hoi-an-cooking-class`. Useful as a regression check after touching the public/admin split.

## Idempotency

Re-running the seed is safe and intended:

- **Destinations + Tours** — `upsert` keyed by `slug`. IDs are preserved between runs, so Postman environment variables like `tourSlug` keep working without manual refresh.
- **Itinerary days** — `upsert` keyed by `(tourId, dayNumber)`.
- **Departures** — no natural unique key (multiple departures can share a `startDate`), so the seed `deleteMany`s every departure tied to a seeded tour, then `createMany`s 30 fresh rows. Dates always re-anchor on "today", so the catalog never goes stale.

The departure reset uses the Booking FK (`Restrict`). If any seeded tour already has a real booking, the delete fails loudly — that's intentional: the seed shouldn't silently throw away real customer data. Move bookings off the affected tour first, or change the tour slug in `prisma/seed.ts`.

## Full reset (DESTRUCTIVE)

When the local DB drifts and you want a clean slate:

```bash
pnpm prisma migrate reset
```

This drops every table, replays migrations, and runs the seed at the end. Never run this against a database you care about — it's a dev-only escape hatch.

## When to reseed

- After `prisma migrate reset` (automatic at the end).
- After pulling a branch that changes seed data (re-run `pnpm db:seed` manually).
- Before a Postman demo or screencast — refreshes the future-dated departures so the catalog looks live.

## Verification in Supabase Studio

1. Open Supabase Dashboard → Table editor.
2. `destinations` → 4 rows, slugs `hoi-an`, `ha-noi`, `sa-pa`, `phu-quoc`.
3. `tours` → 10 rows. Filter `is_published = false` → exactly 1 row (`hoi-an-cooking-class`).
4. `tour_departures` → 30 rows. Sort by `start_date` ascending → earliest date is roughly today + 30 days.
5. `tour_itinerary_days` → 2 rows, both `tour_id` pointing at the Sa Pa trek tour.

Or via Postman: `Tours (Public) → GET /tours` returns 9 rows (the draft is hidden), `Tours (Public) — Departures → GET /tours/sa-pa-trek-2d1n/departures` returns 3 upcoming OPEN departures.

## Customising the seed

Edit `prisma/seed.ts` directly. The data lives in two arrays near the top (`DESTINATIONS`, `TOURS`) — change any field, re-run `pnpm db:seed`, and the upsert path keeps the IDs stable.

Avoid changing slugs unless you also clean up the old rows manually — the seed only upserts the slugs it knows about, so renamed entries leave orphaned rows behind.
