# AHN Partnerships

Internal pipeline for AHN/AHNF 2027 corporate memberships and partnerships - a
simplified sibling of Mercator, with the same stack and conventions.

Every partner is a deal in a pipeline, not one of fifty identical emails: each
deal records what we are asking for (a corporate membership at a fixed-price
tier, a referral/revenue partnership, or a strategic/community partnership),
its stage, who owns it, and the next action and when it is due.

- **Dashboard** - booked revenue against the annual target, weighted pipeline,
  funnel, what is due this week, renewals coming up.
- **Pipeline** - a drag-and-drop board and a filterable table. Closing a
  membership deal as won creates the membership.
- **Partners** - contacts, deals, memberships and a timeline of every note,
  email, call, meeting and stage change.
- **Members** - active members, payment, renewals.
- **Settings** (admins) - target, membership tiers, users, CSV import/export.

```bash
pnpm install && cp .env.example .env
pnpm infra:up && pnpm db:migrate:deploy && pnpm db:seed
pnpm dev
```

- [docs/PLAN.md](docs/PLAN.md) - the plan this was built from.
- [docs/RUNBOOK.md](docs/RUNBOOK.md) - running, migrating, deploying and backing up.
- [CLAUDE.md](CLAUDE.md) - the conventions every change follows.
