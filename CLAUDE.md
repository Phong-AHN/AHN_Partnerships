# AHN Partnerships

Internal pipeline for AHN/AHNF corporate memberships and partnerships (2027+).
Simplified sibling of Mercator (D:\Data\AHN_Media\AHN_MigrateToolSHOPLINE) - same stack and conventions.

- Every mutation goes through `defineAction` (apps/web/src/server/action.ts): auth → permission → zod → handler.
- Validate every DB check constraint in the action first and return `ValidationError` with `fieldErrors`;
  never let a Postgres 23514 reach the user.
- Money is integer cents (`amountMinor`). A membership deal's amount is the tier price snapshotted at assignment.
- Dates: use `clock.now()` from @partners/core, never `new Date()` (lint enforces it).
- Before deploying code with a new migration, run `pnpm db:migrate:deploy` against production.
- `pnpm verify` must pass before every commit.
- Plan: docs/PLAN.md. Operations: docs/RUNBOOK.md.
