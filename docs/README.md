# tourism-be-api — docs

NestJS + Prisma + Supabase + Stripe backend for the tourism booking platform.
This folder is the single source of truth for backend documentation. Inside
the Turborepo monorepo the backend lives at [`apps/api`](../apps/api); the
frontends (`apps/web`, `apps/admin`) are not built yet.

> Docs are **English-only**. The earlier bilingual `en/` + `vi/` split was
> dropped on 2026-05-30 — one language, classified by purpose
> (`reference/` · `runbooks/` · `planning/`).

## Start here (first clone)

New to the repo? Read in this order — overview → domain → run it → details:

1. **This file** — the docs map + conventions (you're here).
2. [reference/architecture.md](reference/architecture.md) — big picture: modules, request lifecycle, auth, response envelope, DB strategy.
3. [reference/erd.md](reference/erd.md) — data model: entities, relations, indexes.
4. [reference/api-overview.md](reference/api-overview.md) — every endpoint by sprint (access, body, error codes).
5. [runbooks/local-dev.md](runbooks/local-dev.md) — **get it running**: clone → install → `apps/api/.env` → migrate → run → smoke test.
6. [reference/functions-customer.md](reference/functions-customer.md) + [reference/functions-admin.md](reference/functions-admin.md) — per-function step lists (behaviour + diagrams).
7. `postman/tourism-api.json` — import into Postman and poke the live API.
8. Remaining runbooks ([seed](runbooks/seed.md), [stripe-testing](runbooks/stripe-testing.md), [postman-auth](runbooks/postman-auth.md), [uploads](runbooks/uploads.md), [email](runbooks/email.md)) — read the one for the feature you touch.
9. [planning/roadmap.md](planning/roadmap.md) + [planning/backlog.md](planning/backlog.md) — where the project is heading (optional context).

The table below is the same thing indexed by role, if you already know what you need.

## Where to start

Pick the path that matches what you're trying to do:

| You are… | Read in order |
| --- | --- |
| **New dev** joining the BE | [reference/architecture.md](reference/architecture.md) → [reference/api-overview.md](reference/api-overview.md) → [reference/erd.md](reference/erd.md) → [runbooks/local-dev.md](runbooks/local-dev.md) |
| **Operator** running the system | [runbooks/local-dev.md](runbooks/local-dev.md) + the topic-specific runbook you need in [runbooks/](runbooks/) |
| **Sprint reviewer / planner** | [planning/roadmap.md](planning/roadmap.md) → [planning/backlog.md](planning/backlog.md) → [planning/sprints/](planning/sprints/) |
| **FE dev** wiring against the API | [reference/api-overview.md](reference/api-overview.md) + [reference/functions-customer.md](reference/functions-customer.md) + [reference/functions-admin.md](reference/functions-admin.md) + live Swagger at `http://localhost:3000/api/docs` + Postman ([postman/tourism-api.json](postman/tourism-api.json)) |
| **Drawing diagrams** (activity / sequence) | [reference/functions-customer.md](reference/functions-customer.md) + [reference/functions-admin.md](reference/functions-admin.md) — per-function step lists + entity/model/table mapping |

## Layout

```text
docs/
├── README.md                  ← you are here (index)
├── reference/                 system understanding
│   ├── architecture.md        modules, request lifecycle, auth, DB, envelope
│   ├── api-overview.md        every endpoint by sprint: access, body, errors
│   ├── erd.md                 Mermaid ERD + indexes (mirrors schema.prisma)
│   ├── functions-customer.md  customer (User) function catalog — U-xx + S-xx
│   └── functions-admin.md     admin function catalog — A-xx (for diagrams)
├── runbooks/                  operations
│   ├── local-dev.md           clone → install → env → migrate → run
│   ├── seed.md                `pnpm db:seed` catalog
│   ├── postman-auth.md        getting real customer/admin JWTs for Newman
│   ├── stripe-testing.md      Checkout + webhook loop (Stripe CLI / harness)
│   ├── uploads.md             Cloudinary signed-upload flow (photos + clips)
│   └── email.md               Resend transactional email setup
├── planning/                  cross-repo planning
│   ├── roadmap.md             sprint roadmap (BE + planned FE)
│   ├── backlog.md             deferred items not in any active sprint
│   └── sprints/               per-sprint plans (B4.6, …)
└── postman/                   generated Postman collection + sources
    ├── tourism-api.json       ← import into Postman / Newman
    ├── seed-test-data.mjs     one-shot test-data + paid-booking harness
    ├── environments/
    └── src/                   edit these, then run `pnpm postman:build`
```

## Conventions

- **Source of truth wins.** When a doc disagrees with code, the code
  (`apps/api/src`, `apps/api/prisma/schema.prisma`) is right — fix the doc.
- **Postman is part of the contract.** Every new endpoint updates the
  collection sources under `postman/src/` + `pnpm postman:build`, committed
  alongside the code.
- **Commands run from the repo root** unless noted. Backend-only commands use
  `pnpm --filter @tourism/api <script>` (e.g. `start:dev`, `db:seed`); the
  backend env file is `apps/api/.env`.
