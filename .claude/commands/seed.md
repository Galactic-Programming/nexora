---
description: Seed local test data + the self-signed paid-booking harness (makes the Newman suite + browser e2e runnable).
allowed-tools: Bash
---

Seed the local test data so the API suite and browser e2e can run.

1. The seed needs the **API running on :3000**. Quick-check it first
   (`curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/v1`). If it's
   not up, tell me to start it (`pnpm --filter @tourism/api start:dev`) and stop —
   don't try to start it yourself unless I ask.
2. Run `pnpm postman:seed` from the repo root.
3. Report what it printed: the customer/admin accounts, the generated
   **paid-booking codes**, and that `.tmp/postman.env.json` was written.

Reads secrets from `apps/api/.env`; prints no secret values. After this,
`pnpm postman:test` (Newman) and the browser e2e flows can run.
