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
const migrating = vercelEnv === 'production' || process.env.MIGRATE_ON_BUILD === '1';

// Say plainly what is missing, before anything else runs. Without this the
// first symptom is Prisma's "Environment variable not found: DIRECT_URL",
// which is what it prints when DATABASE_URL is the one that is absent.
const required = {
  DATABASE_URL: 'the Postgres connection string (pooled, if the host offers one)',
  SESSION_SECRET: 'run: openssl rand -base64 32',
  APP_URL: 'the public URL of this deployment, e.g. https://partners.ahnmedia.com',
  RESEND_API_KEY: 'from resend.com - sign-in links are emailed through Resend',
  EMAIL_FROM: 'e.g. AHN Partnerships <partners@ahnmedia.com>, on a domain verified in Resend',
};
if (vercelEnv === 'production') {
  const missing = Object.keys(required).filter((name) => !process.env[name]?.trim());
  if (missing.length > 0) {
    console.error(
      `\n[vercel-build] Missing environment variable${missing.length > 1 ? 's' : ''} for Production:\n` +
        missing.map((name) => `  - ${name}: ${required[name]}`).join('\n') +
        '\n\nAdd them in Vercel -> Project -> Settings -> Environment Variables (tick "Production"),' +
        '\nthen redeploy. DIRECT_URL is optional: it defaults to DATABASE_URL.\n',
    );
    process.exit(1);
  }
}

if (migrating) {
  console.log(`[vercel-build] ${vercelEnv}: applying database migrations`);
  run('pnpm --filter @partners/db migrate:deploy');
} else {
  console.log(`[vercel-build] ${vercelEnv}: skipping migrations`);
}

run('pnpm --filter @partners/web build');
