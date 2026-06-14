---
description: Regenerate the FE OpenAPI client types from the live Swagger spec (run after any backend response-DTO change).
allowed-tools: Bash
---

Regenerate `apps/web/src/lib/api/schema.d.ts` from the live backend Swagger spec.
Do this after **any** change to a backend response DTO (the typed FE client goes
stale otherwise — see CLAUDE.md gotchas).

1. The generator hits `http://localhost:3000/api/docs-json`, so the **API must be
   running on :3000**. Quick-check it; if it's down, tell me to start it
   (`pnpm --filter @tourism/api start:dev`) and stop.
2. Run `pnpm --filter @tourism/web api:types`.
3. Show `git diff --stat apps/web/src/lib/api/schema.d.ts` and summarize what
   changed (e.g. which DTO gained/lost fields). If `$ARGUMENTS` names a DTO,
   confirm that type specifically now looks right.
4. Remind me to run `/gate` (web typecheck) since the regen can surface type
   breaks in consumers.
