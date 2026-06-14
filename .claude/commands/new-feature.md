---
description: Kick off a new feature the project way — confirm scope, branch, then scaffold a design spec + implementation plan (spec→plan→execute).
argument-hint: <short feature description>
---

We're starting a new feature: **$ARGUMENTS**

Follow the project's spec→plan→execute workflow (CLAUDE.md §"How we work"). Do
**not** write feature code yet.

1. **Restate the goal** in one or two sentences, then **ask me any scope
   questions** you need (use AskUserQuestion for genuine either/or decisions).
   Per convention, confirm scope before touching code.
2. Once scope is agreed, create a feature branch: `feat/<kebab-name>` (never
   work on `master`).
3. Write a **design spec** at
   `docs/superpowers/specs/<YYYY-MM-DD>-<kebab-name>-design.md`, mirroring the
   format of the existing D1–D3 specs: Goal & Scope, locked brainstorm
   decisions, in/out of scope, per-section design, i18n (EN/VI), testing,
   planned files, risks.
4. Write an **implementation plan** at
   `docs/superpowers/plans/<YYYY-MM-DD>-<kebab-name>.md`: dependency-ordered
   tasks, TDD on pure logic, an acceptance check per task, a sequencing line,
   and a "reused seams" list.
5. Commit the spec + plan (`docs(<area>): <feature> spec + plan`), then execute
   task-by-task. Hold to: layout-first + theme tokens only + reuse `@tourism/ui`
   first; EN/VI parity; Postman updated for any API change.
6. Finish with `/gate` + browser e2e, update `docs/planning/roadmap.md`, then
   **STOP and confirm with me before** merge/push/branch-delete.

Start at step 1 now.
