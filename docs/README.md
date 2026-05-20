# tourism-be-api — docs

NestJS + Prisma + Supabase + Stripe backend for the tourism booking platform. This folder is the single source of truth for backend documentation across the 3-repo project (`tourism-be-api`, `tourism-frontend-customer`, `tourism-frontend-admin`).

> Layout was reorganised on 2026-05-20 from `{topic}/{lang}/` → `{lang}/{topic}/` so opening `docs/` shows the language choice first.

## Where to start

Pick the path that matches what you're trying to do:

| You are… | Read in order |
| --- | --- |
| **New dev** joining the BE | [`en/reference/architecture.md`](en/reference/architecture.md) → [`en/reference/api-overview.md`](en/reference/api-overview.md) → [`en/reference/erd.md`](en/reference/erd.md) → [`en/runbooks/local-dev.md`](en/runbooks/local-dev.md) |
| **Operator** running the system | [`en/runbooks/local-dev.md`](en/runbooks/local-dev.md) + any topic-specific runbook in [`en/runbooks/`](en/runbooks/) |
| **Sprint reviewer / planner** | [`en/planning/roadmap.md`](en/planning/roadmap.md) → [`en/planning/BACKLOG.md`](en/planning/BACKLOG.md) → [`en/planning/sprints/`](en/planning/sprints/) |
| **FE dev** wiring against the API | [`en/reference/api-overview.md`](en/reference/api-overview.md) + live Swagger at `http://localhost:3000/api/docs` + Postman ([`postman/tourism-api.json`](postman/tourism-api.json)) |
| **VI reader** | Same paths under [`vi/`](vi/) (translations are parallel for `reference/` + `runbooks/`; `planning/` is EN-only) |

## Layout

```structure
docs/
├── README.md                  ← you are here (EN-only index)
├── en/
│   ├── planning/              cross-repo planning (EN-only, no VI mirror)
│   │   ├── roadmap.md         cross-repo sprint roadmap (BE + 2 FE repos)
│   │   ├── BACKLOG.md         deferred items not in any active sprint
│   │   └── sprints/           per-sprint plans (B4.6, B4.7, …)
│   ├── reference/             system understanding
│   │   ├── architecture.md
│   │   ├── api-overview.md
│   │   └── erd.md             EN-only — Mermaid diagram, language-neutral
│   └── runbooks/              operations: email · local-dev · postman-auth · seed · stripe-testing · uploads
└── vi/
    ├── reference/             parallel VI translation of EN reference (no erd.md — Mermaid)
    └── runbooks/              parallel VI translation of EN runbooks

postman/                       generated Postman collection + sources (sibling of docs/)
├── tourism-api.json           ← import this into Postman / Newman
├── environments/
└── src/                       edit these and run `pnpm postman:build`
```

## Bilingual policy

- **`reference/` + `runbooks/`** — bilingual. Every `en/<topic>/<file>.md` has a `vi/<topic>/<file>.md` counterpart with the same filename. Keep them in parallel when editing.
- **`planning/`** — EN-only. Cross-repo coordination docs; maintaining parallel VI would double the churn for no extra reader. Lives under `en/planning/`.
- **`erd.md`** — EN-only. Just a Mermaid diagram, no prose to translate.
- **`README.md` (this file)** — EN-only for the same reason as `planning/`.

## Related docs in sibling repos

| Repo | Path |
| --- | --- |
| `tourism-frontend-customer` | `docs/en/plan.md` + `docs/vi/plan.md` — customer FE sprint plan (C0→C3) |
| `tourism-frontend-admin` | `docs/en/plan.md` (planned, written after customer FE lands) |

Cross-repo links use textual references (repo-name + path) rather than relative paths, because sibling-repo relative paths break when readers clone repos to different parents.
