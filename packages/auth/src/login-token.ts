import { clock } from '@partners/core';
import { hashToken, randomToken } from '@partners/core/server';
import { db, type LoginTokenPurpose } from '@partners/db';

/**
 * One-time sign-in links. `INVITE` is the first link a person gets, when an
 * admin adds them; `SIGN_IN` is every one after that. Same shape `Session`
 * uses: the raw token exists only in the email, the database keeps its
 * SHA-256, and it is single-use and short-lived.
 */
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SIGN_IN_TTL_MS = 15 * 60 * 1000;

export function ttlForPurpose(purpose: LoginTokenPurpose): number {
  return purpose === 'INVITE' ? INVITE_TTL_MS : SIGN_IN_TTL_MS;
}

export interface IssuedLoginToken {
  token: string;
  expiresAt: Date;
}

export async function createLoginToken(
  userId: string,
  purpose: LoginTokenPurpose,
): Promise<IssuedLoginToken> {
  const token = randomToken(32);
  const now = clock.now();
  const expiresAt = new Date(now.getTime() + ttlForPurpose(purpose));

  await db.loginToken.create({
    data: { userId, purpose, tokenHash: hashToken(token), expiresAt, createdAt: now },
  });

  return { token, expiresAt };
}

export interface ConsumedLoginToken {
  userId: string;
  purpose: LoginTokenPurpose;
}

/**
 * Looks a raw token up, checks it is unused and unexpired, and marks it used
 * in one conditional update, so two concurrent clicks on the same link cannot
 * both succeed. Returns `null` for anything wrong - expired, used, or never
 * issued - without saying which.
 */
export async function consumeLoginToken(rawToken: string): Promise<ConsumedLoginToken | null> {
  const now = clock.now();
  const tokenHash = hashToken(rawToken);

  const result = await db.loginToken.updateMany({
    where: { tokenHash, usedAt: null, expiresAt: { gt: now } },
    data: { usedAt: now },
  });
  if (result.count === 0) return null;

  return db.loginToken.findUniqueOrThrow({
    where: { tokenHash },
    select: { userId: true, purpose: true },
  });
}
