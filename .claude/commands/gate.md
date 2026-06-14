---
description: Run the full quality gate (typecheck + lint + test + build) and report pass/fail. Report-only — do not auto-fix.
allowed-tools: Bash, Read
---

Run the project quality gate from the repo root and report a concise **pass/fail
summary per check**. This is **report-only** — do NOT fix anything unless I ask;
just surface what's broken.

Run these (each spans both apps via turbo):

1. `pnpm typecheck` — `tsc --noEmit` (api + web)
2. `pnpm lint` — eslint (api + web)
3. `pnpm test` — jest (api) + vitest (web)
4. `pnpm build` — turbo build (api `nest build`, web `next build`)

Scope note: if `$ARGUMENTS` names a single app (`api` or `web`), run only that
app's checks via `pnpm --filter @tourism/<app> <script>` instead.

Report each line as ✅ / ❌ with the key numbers (test counts, error/warning
counts, build status). For any ❌, show the relevant failing lines. The 7
pre-existing eslint warnings in `apps/web` test files are known — note them but
don't count them as a failure. End with one-line overall verdict.
