import { clock, ValidationError } from '@partners/core';
import { db } from '@partners/db';

/**
 * Throttles sign-in link requests, keyed by IP rather than by account - see
 * the `SignInThrottle` model's comment for why an account-keyed lockout is
 * itself a denial-of-service vector. Every request counts (each one can send
 * an email); the first few are free, past that the delay doubles each time,
 * capped, and fifteen quiet minutes forgets the count. A completed sign-in
 * clears it. Every function here fails open: the limiter being unavailable
 * must never be the reason a real sign-in cannot happen.
 */
const FREE_ATTEMPTS = 4;
const BASE_DELAY_MS = 1_000;
const MAX_DELAY_MS = 30_000;
const RESET_AFTER_MS = 15 * 60 * 1000;

const SLOW_DOWN_MESSAGE = 'Too many sign-in requests. Wait a moment and try again.';

function delayForAttempts(attempts: number): number {
  if (attempts <= FREE_ATTEMPTS) return 0;
  const exponent = attempts - FREE_ATTEMPTS;
  return Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** (exponent - 1));
}

/** Throws `ValidationError` if this IP needs to wait before trying again. */
export async function checkSignInThrottle(ip: string | null): Promise<void> {
  const key = ip ?? 'unknown';
  let row: { failedAttempts: number; lastAttemptAt: Date } | null;
  try {
    row = await db.signInThrottle.findUnique({
      where: { ip: key },
      select: { failedAttempts: true, lastAttemptAt: true },
    });
  } catch {
    return; // fail open
  }
  if (!row) return;

  const now = clock.now().getTime();
  if (now - row.lastAttemptAt.getTime() > RESET_AFTER_MS) return; // stale, treat as reset

  const delay = delayForAttempts(row.failedAttempts);
  if (delay === 0) return;

  const readyAt = row.lastAttemptAt.getTime() + delay;
  if (now < readyAt) {
    throw new ValidationError(SLOW_DOWN_MESSAGE, { email: [SLOW_DOWN_MESSAGE] });
  }
}

export async function recordSignInAttempt(ip: string | null): Promise<void> {
  const key = ip ?? 'unknown';
  const now = clock.now();
  try {
    const existing = await db.signInThrottle.findUnique({
      where: { ip: key },
      select: { lastAttemptAt: true },
    });
    const stale = existing && now.getTime() - existing.lastAttemptAt.getTime() > RESET_AFTER_MS;
    await db.signInThrottle.upsert({
      where: { ip: key },
      create: { ip: key, failedAttempts: 1, lastAttemptAt: now },
      update: {
        failedAttempts: !existing || stale ? 1 : { increment: 1 },
        lastAttemptAt: now,
      },
    });
  } catch {
    // best-effort only - a failure here must never surface to the caller
  }
}

export async function clearSignInThrottle(ip: string | null): Promise<void> {
  const key = ip ?? 'unknown';
  try {
    // deleteMany, not delete: no row (the usual case) is not an error, and
    // Prisma would otherwise log one on every successful sign-in.
    await db.signInThrottle.deleteMany({ where: { ip: key } });
  } catch {
    // the limiter is unavailable - fine, it fails open
  }
}
