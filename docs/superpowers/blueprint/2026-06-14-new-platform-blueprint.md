# New Platform Blueprint — Lily-style tourism monorepo (greenfield)

**Date:** 2026-06-14
**Status:** Draft for review (founding doc — lives in the current/"donor" repo
until the new repo is scaffolded, then moves there).
**Author context:** drives a from-zero rebuild after the customer-FE/UX analysis
and the reference-site study ([reference-sites-analysis](../research/2026-06-14-reference-sites-analysis.md)).

> **Strategy in one line:** stand up a **brand-new Nx monorepo** (clean data
> model + Lily-style FE + mobile from day one) while **keeping the current repo
> as a read-only "donor"** to port proven code from — so we get a clean slate
> *and* a safety net.

---

## 1. Why greenfield + donor (not in-place rebuild)

- The current repo's **infra is hardened** (Supabase JWT verify, Stripe webhook
  idempotency, Supavisor pooler config, RLS, 324 passing tests) but its **data
  model + FE accreted from some hasty decisions** → the right move is a
  deliberate re-model, not patching.
- Keeping the old repo intact = **zero-risk donor**: we copy proven patterns
  instead of re-deriving solved problems, and the old app keeps running.
- Greenfield lets us add **mobile** correctly from the start (current repo:
  1 BE + 2 FE, no mobile) and design a **shared-code layer** that the current
  repo never had.

---

## 2. Locked decisions

| Area | Choice |
| --- | --- |
| Monorepo orchestrator | **Nx** (+ pnpm as package manager) |
| Why Nx | greenfield, 4 app types, **enforced module boundaries** + generators for tight architectural control |
| Mobile | **Expo / React Native** (shares TS + `core` + tokens with web ⇒ max reuse) |
| Backend | **NestJS** — *fresh clean Prisma schema* + **port** proven infra patterns |
| Web / Admin | **Next.js** (App Router), Lily-style design |
| Visual direction | Lily-adapted (warm, trust-forward) — keep our **self-serve online booking** edge that Lily lacks |
| i18n | EN/VI from day one (carry the parity discipline) |
| Auth / payments | Supabase Auth + Stripe (port) |

---

## 3. Monorepo architecture (Nx layout)

Nx splits **`apps/`** (deployables) and **`libs/`** (shared code), with **tags**
that the `@nx/enforce-module-boundaries` lint rule uses to *forbid* bad imports.

```
tourism-platform/            # new Nx workspace (pnpm)
├── apps/
│   ├── api                  # NestJS         tags: scope:api,  type:app
│   ├── web                  # Next.js cust.  tags: scope:web,  type:app
│   ├── admin                # Next.js admin  tags: scope:admin,type:app
│   └── mobile               # Expo (RN)      tags: scope:mobile,type:app
├── libs/
│   ├── shared/
│   │   ├── core             # types, API client, zod schemas, domain logic
│   │   │                    #   tags: scope:shared, type:data-access
│   │   ├── tokens           # design tokens (color/type/space) → web CSS vars + RN JS
│   │   │                    #   tags: scope:shared, type:ui
│   │   └── i18n             # EN/VI message catalogs + helpers
│   │                        #   tags: scope:shared, type:util
│   ├── web/
│   │   └── ui               # web design system (React + Tailwind/Base UI)
│   │                        #   tags: scope:web, type:ui
│   └── mobile/
│       └── ui               # mobile design system (RN components)
│                            #   tags: scope:mobile, type:ui
└── tools/ , nx.json , tsconfig.base.json , pnpm-workspace.yaml
```

### Module-boundary rules (the "control chặt" Yuri wants)
Enforced in `.eslintrc` via tags — examples:
- `type:app` may import `type:feature|ui|data-access|util`; **apps cannot import other apps**.
- `scope:web` cannot import `scope:mobile` (and vice-versa); both may import `scope:shared`.
- `scope:shared` (core/tokens/i18n) may import **only** `scope:shared` → keeps the reuse engine clean and platform-agnostic.

→ A bad import **fails lint/CI**, not just code review. This is the architectural guardrail the current repo lacks.

---

## 4. The reuse engine — `libs/shared/*`

This is the part the current repo never had (logic is scattered inside
`apps/web`). Centralising it is what makes "reuse without thinking much" real:

| Lib | Holds | Consumed by |
| --- | --- | --- |
| `shared/core` | domain **types**, typed **API client** (OpenAPI), **zod** request/response schemas, pure **business logic** (pricing, status maps, validation) | web · admin · mobile · (api can share types) |
| `shared/tokens` | color / typography / spacing / radius tokens, one source → **web** (CSS variables) + **mobile** (JS theme object) | web ui · mobile ui |
| `shared/i18n` | EN/VI catalogs + parity-checked keys + `t()` helpers | web · admin · mobile |

`web/ui` and `mobile/ui` are **separate** (DOM vs native primitives) but both
consume `shared/tokens` so the Lily design language is identical across platforms.

---

## 5. Port-vs-rebuild map (from the donor repo)

| From current repo | New repo |
| --- | --- |
| Backend **infra**: SupabaseJwtGuard, RolesGuard, envelope interceptor + filter, Joi config, pooler/Prisma adapter setup, Stripe webhook (raw-body + HMAC + idempotency), Resend email, Cloudinary media service | **PORT** (proven — copy + adapt to new schema) |
| **Prisma schema** | **REBUILD fresh** (§6) — deliberate clean model |
| API client + zod schemas + domain types | **PORT → `shared/core`** (refactor for cross-platform) |
| i18n EN/VI keys | **PORT → `shared/i18n`** (extend) |
| All web/admin pages, components, design | **REBUILD 100%** (Lily-style, no mishmash) |
| Mobile | **NEW** (Expo) |
| Tests/e2e patterns, postman harness, CI (`ci.yml`), `/gate` etc. commands | **PORT** the patterns |

---

## 6. New data model (clean, Lily-informed)

Current schema is ~80% there. The new model keeps the strong bones and adds the
Lily fields. **Entities** (Prisma):

- **User** — Supabase mirror (unchanged shape).
- **Destination** — `slug, name(en/vi), region, country, description, heroMedia, isActive`.
- **Tour** — `slug, title, summary, category, durationDays, basePrice, compareAtPrice?(↜ price anchoring), maxGroupSize, difficulty, isPublished, isFeatured, included[], excluded[], highlights[](↜ "value of package"), meetingPoint`.
- **TourDestination** *(NEW, M:N join)* — `tourId, destinationId, isPrimary` → **multi-destination packages** (Lily's "Hanoi→Angkor"). *(decision D1)*
- **TourItineraryDay** — `dayNumber, title, description` (day-by-day).
- **TourDeparture** — `startDate, endDate, priceOverride?, compareAtPrice?, seatsTotal, seatsBooked, status`.
- **TourFaq** *(NEW)* — `tourId, question, answer, order` (or a global `Faq`).
- **TourPolicy** *(NEW or a Tour text field)* — booking/cancellation policy.
- **Review** — `rating, title, body, isApproved` (unchanged).
- **MediaAsset** — polymorphic (owner type/role hero|gallery) (unchanged).
- **Booking / PaymentEvent / Wishlist** — port as-is (booking incl. refund audit).
- **Enquiry** *(NEW, optional)* — `name, email, phone, message, tourId?, status` → Lily-style "Inquire Now" lead capture alongside self-serve booking. *(decision D2)*
- **Trust content** (awards / stats / guarantees / value-props / testimonials) — start **static/config** in FE; promote to a small `Content` model later if it needs editing.

**Open product decisions baked into the model (recommended defaults):**
- **D1 — Multi-destination packages:** *recommend YES* (Lily-aligned) → `Tour ↔ Destination` **M:N** with `isPrimary`. If you only ever sell single-place tours, we keep 1:N and drop the join.
- **D2 — Enquiry/"Inquire Now":** *recommend YES, lightweight* → adds a `contact-for-custom` lead channel on top of self-serve checkout (on-brand, cheap). If not wanted, omit `Enquiry`.

---

## 7. Phased roadmap

| Phase | Deliverable | Notes |
| --- | --- | --- |
| **P0** | Nx workspace scaffold: apps (api/web/admin/mobile) + libs + tags/boundaries + CI + `/gate` | §8 |
| **P1** | **Backend**: fresh schema + migrations + port infra (auth/Stripe/envelope/email/media) + seed | data model §6 |
| **P2** | **Design system**: `shared/tokens` + `web/ui` + `mobile/ui` (Lily-adapted palette/type/pill buttons, core components) | tokens first |
| **P3** | **Web (customer)**: home (destination-led) → destinations + landing → tours (filter) → enriched detail → booking (Stripe) → account/bookings/review | Lily IA |
| **P4** | **Admin**: manage tours/destinations/departures/media/reviews/bookings | |
| **P5** | **Mobile (Expo)**: browse + tour detail + booking + account (reuses `shared/core`) | |
| **P6** | Content/SEO (blog/tips), trust polish | later |

Each phase = its own spec + plan + branch (carry the spec→plan→execute discipline).

---

## 8. Scaffold plan (P0 — concrete)

```bash
# 1. Create the Nx workspace (pnpm, integrated monorepo)
pnpm dlx create-nx-workspace@latest tourism-platform \
  --preset=apps --pm=pnpm --nxCloud=skip

cd tourism-platform

# 2. Add plugins
pnpm add -D @nx/nest @nx/next @nx/expo @nx/react @nx/js

# 3. Generate apps
nx g @nx/nest:app  api    --tags=scope:api,type:app
nx g @nx/next:app  web    --tags=scope:web,type:app
nx g @nx/next:app  admin  --tags=scope:admin,type:app
nx g @nx/expo:app  mobile --tags=scope:mobile,type:app

# 4. Generate shared libs
nx g @nx/js:lib core   --directory=libs/shared/core   --tags=scope:shared,type:data-access
nx g @nx/js:lib tokens --directory=libs/shared/tokens --tags=scope:shared,type:ui
nx g @nx/js:lib i18n   --directory=libs/shared/i18n   --tags=scope:shared,type:util
nx g @nx/react:lib ui  --directory=libs/web/ui        --tags=scope:web,type:ui
nx g @nx/react:lib ui  --directory=libs/mobile/ui     --tags=scope:mobile,type:ui

# 5. Wire @nx/enforce-module-boundaries with the tag rules (§3)
# 6. Port CI (ci.yml), .gitignore, CLAUDE.md, .claude/commands from donor
```

*(Exact generator flags get finalized against the installed Nx version — Nx 21+
changed some defaults; we read the live docs at scaffold time.)*

---

## 9. Risks & guardrails

- **Scope is large (4 apps + mobile)** → strictly phase it (P0→P6); never "all at once". Each phase shippable + verified before the next.
- **Expo + Nx + Next version drift** → pin versions; scaffold against current docs, not memory.
- **Don't re-derive solved infra** → port from donor (auth/webhook/pooler) rather than rewrite.
- **Reuse engine discipline** → `shared/*` must stay platform-agnostic (boundary lint enforces it).
- **Keep EN/VI parity + TDD-on-logic + spec→plan** disciplines from day one.
- **Donor repo stays untouched/running** as reference + fallback.

---

## 10. Decisions to confirm before P0

1. **Repo name + location** (default proposal: `tourism-platform` as a sibling dir, e.g. `c:\develop\Apps\Main-Projects\tourism-platform`).
2. **D1 — multi-destination packages?** (recommend YES → M:N).
3. **D2 — Enquiry/"Inquire Now" lead channel?** (recommend YES, lightweight).
4. Anything to ADD to the data model now (e.g. gift cards, group/private toggle, seasons) — cheaper to model up front.
