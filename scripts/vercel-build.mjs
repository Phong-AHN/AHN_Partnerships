// Vercel build command (see apps/web/vercel.json).
//
// Mercator went down once because code that needed a new migration was
// deployed before the migration ran. Here the production build applies
// pending migrations first, so the new code never meets an old schema.
// `prisma migrate deploy` only applies committed migrations and never resets
// or drops anything; if it fails, the build fails and the old deploy keeps
// serving.
//
// Preview builds do NOT migrate - give previews their own DATABASE_URL and
// set MIGRATE_ON_BUILD=1 there if you want them migrated too.
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const run = (command) => execSync(command, { stdio: 'inherit', cwd: root });

const vercelEnv = process.env.VERCEL_ENV ?? 'local';
if (vercelEnv === 'production' || process.env.MIGRATE_ON_BUILD === '1') {
  console.log(`[vercel-build] ${vercelEnv}: applying database migrations`);
  run('pnpm --filter @partners/db migrate:deploy');
} else {
  console.log(`[vercel-build] ${vercelEnv}: skipping migrations`);
}

run('pnpm --filter @partners/web build');
