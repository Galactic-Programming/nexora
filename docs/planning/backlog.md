<!-- markdownlint-disable MD013 -->
<!-- MD013 (line length): tables, URLs, and command one-liners cannot wrap
     without breaking GFM rendering or copy-paste. -->

# Backlog — out-of-scope items

Features that surface in the Figma design or sprint planning but are deliberately deferred. Document why each one is here so a future maintainer knows whether to revive or drop it.

Last reviewed: 2026-05-14.

## Build Your Own Package

**Where it appears**: Services dropdown → "Build Package" + modal with 19 activity preferences (Culture, Outdoors, Relaxing, Wildlife, Romantic, Religious, Hiking, Musical, Shopping, Business, Museums, Party, Traditions, Walks, Fishing, Cruise, Guide, Healthcare, Accommodation), multi-destination input, date range, guests.

**Why deferred**:

- Requires a separate `CustomPackage` model — not derivable from existing `Tour`.
- Needs a matching algorithm (preferences → suggested tours) which is its own feature.
- Out of thesis scope; the demo doesn't need to show personalised package building.

**Revival plan** (if ever):

- New table `custom_packages(id, userId, destinations[], dateRange, preferences[], guests, status)`.
- New endpoint `POST /custom-packages` to persist a request.
- Optional admin endpoint to convert a request into a quoted custom Tour.
- Activity preferences become a separate enum/lookup so admins can extend without code changes.

## Newsletter subscribe

**Where it appears**: Footer of every Figma page — email input + Subscribe button.

**Why deferred**:

- Trivial endpoint (1 table, 1 POST) but has no upstream consumer yet (no campaign tool wired, no admin export).
- Better added when the FE marketing surfaces actually need it, so we don't ship a half-feature.

**Revival plan**:

- Resend Audiences API (the same `resend` SDK we already use has it) — no separate vendor needed.
- Endpoint `POST /newsletter` → forward email to Resend Audience.
- Footer hooks straight into that endpoint.

## Activity preferences taxonomy

**Where it appears**: Build Your Own Package modal.

**Why deferred**: Part of the Build Package feature above. Listed separately because even without the full builder, the FE might want to show preference chips on a profile page for personalisation later.

## Review edit / delete

**Where it appears**: Not in current Figma, but discussed during Sprint B4.1.

**Why deferred**: Reviews are post-trip "frozen" content by design (Airbnb / Booking.com pattern). Letting customers edit re-opens moderation questions (re-approve after every edit?). Deferred until a real user need surfaces.

**Revival plan**:

- `PATCH /reviews/:id` (customer must own, edit window e.g. 7 days post-create) → flips `isApproved=false` for re-moderation.
- `DELETE /reviews/:id` (customer must own OR admin).

## Multi-currency revenue

**Where it appears**: Implicit — schema allows mixed-currency `Tour.currency` per row, but `GET /admin/stats.totalRevenue` aggregates raw amounts as if all USD.

**Why deferred**: The thesis seed is USD-only. Real multi-currency needs either daily FX-rate conversion or a per-currency revenue breakdown in the response. Both are non-trivial and the demo doesn't need it.

**Revival plan**:

- Split `overview.totalRevenue` into `byCurrency: Record<string, string>`.
- Or store a daily FX-rate snapshot table and convert at query time.

## Partner logos strip (Emirates, Trivago, Airbnb, Turkish Airlines, Swiss)

**Where it appears**: Home page, between hero and "We Offer Best Services".

**Status**: **NOT BACKLOG — static FE content**. Recorded here so it isn't accidentally turned into a BE concern. No DB, no endpoint. The FE hard-codes the logo URLs.

## Notes

- Promotion of an item from backlog to a sprint requires updating `docs/planning/roadmap.md` first.
- If something here is genuinely dead (e.g. partner logos are settled as static), strike it through but keep the entry so the decision is auditable.
