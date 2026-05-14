# tourism-be-api — docs

NestJS + Prisma + Supabase + Stripe backend for the tourism booking platform. This folder is the single source of truth for backend documentation across the 3-repo project (`tourism-be-api`, `tourism-frontend-customer`, `tourism-frontend-admin`).

## Where to start

Pick the path that matches what you're trying to do:

| You are… | Read in order |
| --- | --- |
| **New dev** joining the BE | [`reference/en/architecture.md`](reference/en/architecture.md) → [`reference/en/api-overview.md`](reference/en/api-overview.md) → [`reference/en/erd.md`](reference/en/erd.md) → [`runbooks/en/local-dev.md`](runbooks/en/local-dev.md) |
| **Operator** running the system | [`runbooks/en/local-dev.md`](runbooks/en/local-dev.md) + any topic-specific runbook in [`runbooks/en/`](runbooks/en/) |
| **Sprint reviewer / planner** | [`planning/roadmap.md`](planning/roadmap.md) → [`planning/BACKLOG.md`](planning/BACKLOG.md) → [`planning/sprints/`](planning/sprints/) |
| **FE dev** wiring against the API | [`reference/en/api-overview.md`](reference/en/api-overview.md) + live Swagger at `http://localhost:3000/api/docs` + Postman ([`postman/tourism-api.json`](postman/tourism-api.json)) |

## Layout

```structure
docs/
├── README.md              ← you are here
├── planning/              multi-repo planning artefacts, EN-only
│   ├── roadmap.md         cross-repo sprint roadmap (BE + 2 FE repos)
│   ├── BACKLOG.md         deferred items not in any active sprint
│   └── sprints/           per-sprint plans (B4.6, …)
├── reference/             system understanding, bilingual EN ⇄ VI
│   ├── en/
│   │   ├── architecture.md
│   │   ├── api-overview.md
│   │   └── erd.md
│   └── vi/                parallel VI translation (erd.md is EN-only — Mermaid diagram)
├── runbooks/              operations, bilingual EN ⇄ VI
│   ├── en/   email · local-dev · postman-auth · seed · stripe-testing · uploads
│   └── vi/   parallel VI translation
└── postman/               generated Postman collection + sources
    ├── tourism-api.json   ← import this into Postman / Newman
    ├── environments/
    └── src/               edit these and run `pnpm postman:build`
```

## Bilingual policy

- **`reference/` + `runbooks/`** — bilingual. Every EN file has a VI counterpart with the same filename. Keep them in parallel when editing.
- **`planning/`** — EN-only. These are cross-repo coordination docs; maintaining parallel VI would double the churn for no extra reader.
- **`README.md` (this file)** — EN-only for the same reason.

## Related docs in sibling repos

| Repo | Path |
| --- | --- |
| `tourism-frontend-customer` | `docs/en/plan.md` + `docs/vi/plan.md` — customer FE sprint plan (C0→C3) |
| `tourism-frontend-admin` | `docs/en/plan.md` (planned, written after customer FE lands) |

Cross-repo links use textual references (repo-name + path) rather than relative paths, because sibling-repo relative paths break when readers clone repos to different parents.
