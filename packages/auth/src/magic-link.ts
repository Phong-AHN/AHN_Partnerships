import { clock } from '@partners/core';
import { db } from '@partners/db';
import { createLoginToken, consumeLoginToken, type IssuedLoginToken } from './login-token';
import { checkSignInThrottle, clearSignInThrottle, recordSignInAttempt } from './rate-limit';
import { createSession, type IssuedSession } from './session';

/**
 * Passwordless sign-in: ask for a link, click the link. The caller (the web
 * app) builds the URL and sends the email; this package decides who gets a
 * link and what a link is worth.
 */

/** One link per person per minute - a double-click must not send two emails. */
export const SIGN_IN_LINK_COOLDOWN_MS = 60 * 1000;

export interface SignInLinkRecipient extends IssuedLoginToken {
  userId: string;
  name: string;
  email: string;
}

/**
 * Returns a fresh link for an active account, or `null` - for an unknown
 * address, a deactivated account, or a request inside the cooldown. The
 * caller answers all of those the same way ("if that address has an account,
 * a link is on its way"), so the response never reveals who has an account.
 * Throws `ValidationError` only when this IP is asking too often.
 */
export async function prepareSignInLink(
  emailInput: string,
  meta: { ip?: string | null } = {},
): Promise<SignInLinkRecipient | null> {
  const ip = meta.ip ?? null;
  await checkSignInThrottle(ip);
  await recordSignInAttempt(ip);

  const email = emailInput.trim().toLowerCase();
  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, isActive: true },
  });
  if (!user || !user.isActive) return null;

  const recent = await db.loginToken.count({
    where: {
      userId: user.id,
      usedAt: null,
      createdAt: { gt: new Date(clock.now().getTime() - SIGN_IN_LINK_COOLDOWN_MS) },
    },
  });
  if (recent > 0) return null;

  const issued = await createLoginToken(user.id, 'SIGN_IN');
  return { ...issued, userId: user.id, name: user.name, email: user.email };
}

export interface CompletedSignIn {
  session: IssuedSession;
  userId: string;
}

/** Spends a link and opens a session, or `null` if the link is no good. */
export async function completeSignIn(
  rawToken: string,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<CompletedSignIn | null> {
  const consumed = await consumeLoginToken(rawToken);
  if (!consumed) return null;

  const user = await db.user.findUnique({
    where: { id: consumed.userId },
    select: { id: true, isActive: true },
  });
  if (!user?.isActive) return null;

  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: clock.now() } });
  await clearSignInThrottle(meta.ip ?? null);

  return { session: await createSession(user.id, meta), userId: user.id };
}
