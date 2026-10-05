import { loadRootEnv } from '@partners/config';
import type * as core from '@partners/core';
import { PrismaClient, Prisma, type $Enums } from '@prisma/client';

// Next.js loads `.env` relative to `apps/web`. The workspace keeps one `.env`
// at the root, so every process that touches the database reads it from the
// same place.
loadRootEnv();

export * from '@prisma/client';
export { Prisma };

declare global {
  var __partnersPrisma: PrismaClient | undefined;
}

/**
 * One client per process. Next.js reloads modules in development, so without
 * the global the dev server exhausts the connection pool within a few edits.
 *
 * Only this package may construct a PrismaClient; ESLint refuses
 * `@prisma/client` imports in the web app.
 */
export const db: PrismaClient =
  globalThis.__partnersPrisma ??
  new PrismaClient({
    // Silent under test: integration tests provoke constraint errors on purpose.
    log: process.env.NODE_ENV === 'test' ? [] : ['warn', 'error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.__partnersPrisma = db;
}

export type DbClient = PrismaClient;
export type DbTransaction = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

/** Every multi-row mutation runs inside one of these. */
export function transaction<T>(fn: (tx: DbTransaction) => Promise<T>): Promise<T> {
  return db.$transaction(fn, { timeout: 15_000 });
}

/** True when Postgres rejected the write because of a (named) check constraint. */
export function isCheckConstraintViolation(error: unknown, constraint?: string): boolean {
  const message =
    error instanceof Prisma.PrismaClientKnownRequestError ||
    error instanceof Prisma.PrismaClientUnknownRequestError
      ? String(error.message)
      : '';
  if (!message.includes('violates check constraint') && !message.includes('23514')) return false;
  return constraint ? message.includes(constraint) : true;
}

export function isUniqueViolation(error: unknown, target?: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code !== 'P2002') return false;
  if (!target) return true;
  const meta = error.meta as { target?: string[] | string } | undefined;
  const fields = Array.isArray(meta?.target) ? meta.target.join(',') : (meta?.target ?? '');
  return fields.includes(target);
}

// ---------------------------------------------------------------------------
// The enums in @partners/core are hand-written so the browser never imports
// Prisma. These lines fail the typecheck the moment the two drift apart.
// ---------------------------------------------------------------------------
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const _enumsInStep: [
  Same<core.UserRole, $Enums.UserRole>,
  Same<core.Entity, $Enums.Entity>,
  Same<core.Sector, $Enums.Sector>,
  Same<core.Priority, $Enums.Priority>,
  Same<core.AskType, $Enums.AskType>,
  Same<core.DealStage, $Enums.DealStage>,
  Same<core.MembershipStatus, $Enums.MembershipStatus>,
  Same<core.ActivityType, $Enums.ActivityType>,
] = [true, true, true, true, true, true, true, true];
void _enumsInStep;
