'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import {
  completeSignIn,
  prepareSignInLink,
  requireSession,
  revokeSession,
  SESSION_COOKIE,
  sessionCookieOptions,
} from '@partners/auth';
import { ValidationError } from '@partners/core';
import { logger } from '@partners/observability';
import { landingPathFor } from '@partners/rbac';
import { sendSignInEmail } from '@/server/email';
import { requestMeta } from '@/server/session';
import { actionError, actionOk, type ActionResult } from '@/server/action';

/**
 * Sign-in is passwordless: ask for a link, click the link. Both actions run
 * signed out, so neither is built with `defineAction` - there is no principal
 * yet - and each does its own validation.
 */

const GENERIC_SENT = 'If that address has an account, a sign-in link is on its way.';

function safeNext(next: string | null | undefined): string | null {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : null;
}

const requestInput = z.object({
  email: z
    .string({ required_error: 'Enter your email address.' })
    .trim()
    .min(1, 'Enter your email address.')
    .email('Enter a valid email address.'),
  next: z.string().optional(),
});

/**
 * Always the same answer whether or not the address has an account, so the
 * form cannot be used to find out who works here. A failed send is logged,
 * not shown, for the same reason.
 */
export async function requestSignInLinkAction(
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<{ email: string }>> {
  const parsed = requestInput.safeParse({
    email: form.get('email') ?? undefined,
    next: form.get('next') ?? undefined,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      (fieldErrors[issue.path.join('.') || '_'] ??= []).push(issue.message);
    }
    return actionError('Check the details below.', fieldErrors);
  }

  try {
    const meta = await requestMeta();
    const link = await prepareSignInLink(parsed.data.email, meta);
    if (link) {
      await sendSignInEmail({
        to: link.email,
        name: link.name,
        token: link.token,
        expiresAt: link.expiresAt,
        next: safeNext(parsed.data.next),
      }).catch((error: unknown) => {
        logger.error({ err: error, userId: link.userId }, 'sign-in email failed to send');
      });
    }
  } catch (error) {
    if (error instanceof ValidationError) return actionError(error.userMessage, error.fieldErrors);
    logger.error({ err: error }, 'requestSignInLinkAction failed');
    return actionError('Something went wrong. Try again in a moment.');
  }

  return actionOk({ email: parsed.data.email.toLowerCase() }, GENERIC_SENT);
}

const verifyInput = z.object({ token: z.string().trim().min(1), next: z.string().optional() });

/**
 * Spends the link. Runs from a button on `/sign-in/verify`, not from the GET
 * of the link itself: mail scanners (Outlook Safe Links and the like) open
 * every link in an email, and a link that signed in on GET would be used up
 * by the scanner before the person ever clicked it.
 */
export async function verifySignInAction(
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<never>> {
  const parsed = verifyInput.safeParse({
    token: form.get('token') ?? undefined,
    next: form.get('next') ?? undefined,
  });
  if (!parsed.success) return actionError('That link is incomplete. Ask for a new one.');

  let destination: string;
  try {
    const meta = await requestMeta();
    const signedIn = await completeSignIn(parsed.data.token, meta);
    if (!signedIn) {
      return actionError('That link has expired or was already used. Ask for a new one below.');
    }
    const store = await cookies();
    store.set(SESSION_COOKIE, signedIn.session.token, sessionCookieOptions());
    const { principal } = await requireSession(signedIn.session.token);
    destination = safeNext(parsed.data.next) ?? landingPathFor(principal);
  } catch (error) {
    logger.error({ err: error }, 'verifySignInAction failed');
    return actionError('Sign-in could not be completed. Try again.');
  }

  // Outside the try: `redirect` works by throwing, and must not be caught.
  redirect(destination);
}

export async function signOutAction(): Promise<void> {
  const store = await cookies();
  await revokeSession(store.get(SESSION_COOKIE)?.value);
  store.delete(SESSION_COOKIE);
  redirect('/sign-in');
}
