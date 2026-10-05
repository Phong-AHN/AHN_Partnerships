# AHN Partnerships - runbook

How to run, change, deploy and back up the app. The design and the reasons
behind it are in [PLAN.md](PLAN.md).

## Run it locally

Needs Node 22+, pnpm 10 and Docker Desktop.

```bash
pnpm install
cp .env.example .env          # first time only; the defaults work locally
pnpm infra:up                 # Postgres 17 on localhost:5434 (not Mercator's 5433)
pnpm db:migrate:deploy        # apply migrations
pnpm db:seed                  # tiers, the first admin, settings, Bryan's 50 partners
pnpm dev                      # http://localhost:3000
```

Sign in with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` from `.env`
(locally `admin@ahnmedia.com` / `change-me-on-first-login`).

The seed is idempotent: it never overwrites a tier, user, setting or partner
that already exists, so running it again is safe.

Start over with an empty database: `pnpm infra:reset`, then migrate and seed.

## Checks

| Command                 | What it runs                                                        |
| ----------------------- | ------------------------------------------------------------------- |
| `pnpm verify`           | prettier, eslint, typecheck, unit tests - must pass before a commit |
| `pnpm test:integration` | server actions against the real local Postgres (needs `infra:up`)   |

Integration tests create their own uniquely named rows and delete them
afterwards; they never touch the seeded data.

## Change the database

1. Edit `packages/db/prisma/schema.prisma`.
2. `pnpm --filter @partners/db exec prisma migrate dev --name what_changed`
   (add `--create-only` when you need to hand-write SQL, e.g. a check
   constraint, then run `pnpm db:migrate:dev` to apply it).
3. If you add a check constraint, check the same rule in the server action
   first and return a `ValidationError` with `fieldErrors` - a user must never
   see a Postgres 23514. Add a case to
   `packages/db/src/constraints.integration.test.ts`.
4. If you add or rename an enum value, update `packages/core/src/enums.ts` and
   `labels.ts` too - `packages/db/src/index.ts` fails the typecheck until they
   match.

## Deploy (Vercel + managed Postgres)

### One-time setup

1. **Database.** Create a Postgres 17 database for this app only (Neon or
   Railway) - never Mercator's. Note two connection strings:
   - `DATABASE_URL`: the pooled one (Neon: the `-pooler` host, with
     `?sslmode=require&pgbouncer=true`).
   - `DIRECT_URL`: the direct, non-pooled one. Migrations use it.
2. **Vercel project.** Import the Git repository, then:
   - Root Directory: `apps/web` (framework: Next.js; region `sin1` and the
     build command come from `apps/web/vercel.json`).
   - Environment variables (Production):

     | Name             | Value                                                                           |
     | ---------------- | ------------------------------------------------------------------------------- |
     | `DATABASE_URL`   | pooled connection string                                                        |
     | `DIRECT_URL`     | direct connection string                                                        |
     | `APP_URL`        | the production URL, e.g. `https://partners.ahnmedia.com` - used in invite links |
     | `SESSION_SECRET` | `openssl rand -base64 32`                                                       |
     | `LOG_LEVEL`      | `info`                                                                          |

   - Preview deployments: give them a **separate** database (or no
     `DATABASE_URL`), never production's.
3. **First deploy.** Push to the production branch. The build
   (`scripts/vercel-build.mjs`) runs `prisma migrate deploy` before
   `next build` on production builds, so the schema is created then.
4. **Seed once**, from your machine, against production:

   ```bash
   DATABASE_URL="<direct url>" DIRECT_URL="<direct url>" \
   SEED_ADMIN_EMAIL=bryan@ahnmedia.com SEED_ADMIN_NAME="Bryan Pham" \
   SEED_ADMIN_PASSWORD="<a long temporary password>" \
   pnpm db:seed
   ```

   Then sign in, and from **Settings → Users** invite the rest of the team
   (Phong as Admin, others as Member). Each invite gives a one-time link to
   send them yourself - the app does not send email.

5. Check `https://<host>/api/health` returns `{"ok":true,"migration":"…"}`.

### Every deploy

- **Migrations run before the new code.** On Vercel production builds that is
  automatic (above). If you ever deploy another way, run
  `DATABASE_URL=… DIRECT_URL=… pnpm db:migrate:deploy` against production
  _first_ - deploying code ahead of its migration is exactly what took
  Mercator's project page down.
- A failed migration fails the build, and the previous deployment keeps
  serving. Fix the migration, push again.
- After deploying, open `/api/health`: it names the latest applied migration.

## Back up and restore

- **Managed backups.** Neon keeps point-in-time history (check the plan's
  retention); Railway takes daily backups on paid plans. Confirm it is on.
- **Your own copy**, e.g. weekly or before a risky change:

  ```bash
  pg_dump "<direct url>" --format=custom --no-owner --file=partners-$(date +%F).dump
  ```

- **Restore** into a fresh, empty database, then point `DATABASE_URL` /
  `DIRECT_URL` at it:

  ```bash
  pg_restore --no-owner --dbname="<new direct url>" partners-YYYY-MM-DD.dump
  ```

- A spreadsheet snapshot of the pipeline at any time: **Settings → Import &
  export → Download CSV** (or `/api/export`). It is in the import format, so it
  can be imported back.

## Common problems

| Symptom                                                                          | Cause and fix                                                                                                                                                          |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Prisma Client could not locate the Query Engine for runtime rhel-openssl-3.0.x` | The engine was not traced into the function. `binaryTargets` in `schema.prisma` and `outputFileTracingIncludes` in `next.config.ts` handle this; do not remove either. |
| Page errors after a deploy mentioning a missing column or table                  | The migration did not run. Run `pnpm db:migrate:deploy` against production, then redeploy.                                                                             |
| `Invalid environment configuration` at boot                                      | A required variable is missing - the message lists which.                                                                                                              |
| Someone forgot their password                                                    | An admin opens **Settings → Users → Reset link** and sends them the link.                                                                                              |
| Locked out because the only admin left                                           | Not possible from the app (it always keeps one active admin). From a shell: `UPDATE "User" SET role='ADMIN', "isActive"=true WHERE email='…';`                         |
| `pnpm infra:up` fails                                                            | Docker Desktop is not running, or port 5434 is taken.                                                                                                                  |
