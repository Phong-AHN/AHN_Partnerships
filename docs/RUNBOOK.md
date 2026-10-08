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

Sign in with `SEED_ADMIN_EMAIL` from `.env` (locally `admin@ahnmedia.com`).
There are no passwords: you get a one-time link. With `RESEND_API_KEY` empty
(the local default) the email is not sent - it is printed in the `pnpm dev`
terminal; open the link from there.

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

1. **Email (Resend).** In resend.com add and verify the sending domain (e.g.
   `ahnmedia.com`: add the DNS records Resend shows), then create an API key
   with sending access. Sign-in links and invitations go out from
   `EMAIL_FROM`, which must be on that verified domain - otherwise Resend
   rejects every send.
2. **Database.** Create a Postgres 17 database for this app only (Neon or
   Railway) - never Mercator's. Note two connection strings:
   - `DATABASE_URL`: the pooled one (Neon: the `-pooler` host, with
     `?sslmode=require&pgbouncer=true`).
   - `DIRECT_URL`: the direct, non-pooled one. Migrations use it.
3. **Vercel project.** Import the Git repository, then:
   - Root Directory: `apps/web` (framework: Next.js; region `hnd1` - Tokyo, next to the
     database in `ap-northeast-1` - and the
     build command come from `apps/web/vercel.json`).
   - Environment variables (Production):

     | Name             | Value                                                                           |
     | ---------------- | ------------------------------------------------------------------------------- |
     | `DATABASE_URL`   | pooled connection string                                                        |
     | `DIRECT_URL`     | direct connection string - optional, defaults to `DATABASE_URL`                 |
     | `APP_URL`        | the production URL, e.g. `https://partners.ahnmedia.com` - used in invite links |
     | `SESSION_SECRET` | `openssl rand -base64 32`                                                       |
     | `RESEND_API_KEY` | the Resend API key - required in production                                     |
     | `EMAIL_FROM`     | e.g. `AHN Partnerships <partners@ahnmedia.com>`, on the verified domain         |
     | `LOG_LEVEL`      | `info`                                                                          |

   - Preview deployments: give them a **separate** database (or no
     `DATABASE_URL`), never production's.
4. **First deploy.** Push to the production branch. The build
   (`scripts/vercel-build.mjs`) runs `prisma migrate deploy` before
   `next build` on production builds, so the schema is created then.
5. **Seed once**, from your machine, against production:

   ```bash
   DATABASE_URL="<direct url>" DIRECT_URL="<direct url>" \
   SEED_ADMIN_EMAIL=bryan@ahnmedia.com SEED_ADMIN_NAME="Bryan Pham" \
   ```

\
pnpm db:seed

````

Then sign in at the production URL with that email - the link arrives by
email - and from **Settings → Users** invite the rest of the team (Phong as
Admin, others as Member). Each invitation is emailed automatically.

6. Check `https://<host>/api/health` returns `{"ok":true,"migration":"…"}`.

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
````

- **Restore** into a fresh, empty database, then point `DATABASE_URL` /
  `DIRECT_URL` at it:

  ```bash
  pg_restore --no-owner --dbname="<new direct url>" partners-YYYY-MM-DD.dump
  ```

- A spreadsheet snapshot of the pipeline at any time: **Settings → Import &
  export → Download CSV** (or `/api/export`). It is in the import format, so it
  can be imported back.

## Common problems

| Symptom                                                                          | Cause and fix                                                                                                                                                                                                       |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Prisma Client could not locate the Query Engine for runtime rhel-openssl-3.0.x` | The engine was not traced into the function. `binaryTargets` in `schema.prisma` and `outputFileTracingIncludes` in `next.config.ts` handle this; do not remove either.                                              |
| Page errors after a deploy mentioning a missing column or table                  | The migration did not run. Run `pnpm db:migrate:deploy` against production, then redeploy.                                                                                                                          |
| `Invalid environment configuration` at boot                                      | A required variable is missing - the message lists which.                                                                                                                                                           |
| Build fails with `Missing environment variables for Production`                  | Add the variables it lists in Vercel → Settings → Environment Variables (Production), then redeploy.                                                                                                                |
| Build fails with Prisma `Environment variable not found: DIRECT_URL`             | Misleading: it means `DATABASE_URL` is missing for that environment. `DIRECT_URL` itself is optional.                                                                                                               |
| Someone cannot sign in                                                           | They ask for a new link on the sign-in page (sign-in links last 15 minutes, invitations 7 days). An admin can also press **Send sign-in link** in Settings → Users.                                                 |
| Sign-in emails never arrive                                                      | Look in the Vercel logs for `resend send failed` - usually `EMAIL_FROM` is not on a verified Resend domain, or the key is wrong. The sign-in page shows the same "check your email" message either way, on purpose. |
| A link says "already used" though nobody clicked it                              | Opening a link only shows a confirm button, so mail scanners cannot spend it - ask for a new link. If it keeps happening, check whether something is submitting forms on the person's behalf.                       |
| Locked out because the only admin left                                           | Not possible from the app (it always keeps one active admin). From a shell: `UPDATE "User" SET role='ADMIN', "isActive"=true WHERE email='…';`                                                                      |
| `pnpm infra:up` fails                                                            | Docker Desktop is not running, or port 5434 is taken.                                                                                                                                                               |
