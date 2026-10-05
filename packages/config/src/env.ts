import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { config as parseDotenv } from 'dotenv';
import { z } from 'zod';

/**
 * Walks up from the current working directory looking for `pnpm-workspace.yaml`
 * and loads the `.env` that sits beside it. Never overwrites a variable that is
 * already set, and skips entirely in production where the platform supplies
 * real environment variables.
 */
export function loadRootEnv(): void {
  if (process.env.NODE_ENV === 'production') return;

  let dir = resolve(process.cwd());
  for (let depth = 0; depth < 8; depth += 1) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) {
      const envPath = join(dir, '.env');
      if (existsSync(envPath)) {
        parseDotenv({ path: envPath, override: false, quiet: true });
      }
      return;
    }
    const parent = dirname(dir);
    if (parent === dir) return;
    dir = parent;
  }
}

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_URL: z.string().url().default('http://localhost:3000'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),

  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().optional(),

  SESSION_SECRET: z
    .string()
    .min(1, 'SESSION_SECRET is required')
    .refine((v) => Buffer.from(v, 'base64').length >= 24, {
      message: 'SESSION_SECRET must decode to at least 24 bytes of base64',
    }),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

/**
 * Validated environment. Throws once, at first access, with every problem
 * listed - a missing secret fails the boot rather than the first request that
 * happens to need it.
 */
export function env(): Env {
  if (cached) return cached;

  loadRootEnv();

  if (process.env.SKIP_ENV_VALIDATION === 'true') {
    cached = schema.parse({
      DATABASE_URL:
        process.env.DATABASE_URL ?? 'postgresql://partners:partners@localhost:5434/partners',
      SESSION_SECRET: process.env.SESSION_SECRET ?? Buffer.alloc(32, 1).toString('base64'),
    });
    return cached;
  }

  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }

  cached = parsed.data;
  return cached;
}

/** Test hook. Not exported from the package barrel on purpose. */
export function __resetEnvCacheForTests(): void {
  cached = null;
}
