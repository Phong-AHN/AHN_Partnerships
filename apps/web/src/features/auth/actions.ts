'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import {
  checkPasswordStrength,
  consumePasswordToken,
  createSession,
  hashPassword,
  requireSession,
  revokeAllSessionsForUser,
  revokeSession,
  SESSION_COOKIE,
  sessionCookieOptions,
  signIn as performSignIn,
} from '@partners/auth';
import { isAppError, ValidationError } from '@partners/core';
import { db } from '@partners/db';
import { logger } from '@partners/observability';
import { landingPathFor } from '@partners/rbac';
import { requestMeta } from '@/server/session';
import { actionError, type ActionResult } from '@/server/action';

/**
 * The actions here run signed out, so none of them is built with
 * `defineAction`: there is no principal for it to resolve. Each does its own
 * validation and never asserts a permission.
 */

const signInInput = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Enter your email address.')
    .email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
  next: z.string().optional(),
});

function issuesToFieldErrors(issues: z.ZodIssue[]): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of issues) (fieldErrors[issue.path.join('.') || '_'] ??= []).push(issue.message);
  return fieldErrors;
}

export async function signInAction(_prev: unknown, form: FormData): Promise<ActionResult<never>> {
  const parsed = signInInput.safeParse({
    email: form.get('email'),
    password: form.get('password'),
    next: form.get('next') ?? undefined,
  });
  if (!parsed.success) {
    return actionError('Check the details below.', issuesToFieldErrors(parsed.error.issues));
  }

  let destination: string;
  try {
    const meta = await requestMeta();
    const { session } = await performSignIn(parsed.data.email, parsed.data.password, meta);

    const store = await cookies();
    store.set(SESSION_COOKIE, session.token, sessionCookieOptions());

    const resolved = await requireSession(session.token);
    const fallback = landingPathFor(resolved.principal);
    // Only same-origin paths are honoured, so `?next=` cannot become an open
    // redirect to somebody else's site.
    const requested = parsed.data.next;
    destination =
      requested && requested.startsWith('/') && !requested.startsWith('//') ? requested : fallback;
  } catch (error) {
    if (error instanceof ValidationError) {
      return actionError(error.userMessage, error.fieldErrors);
    }
    if (!isAppError(error)) logger.error({ err: error }, 'sign-in failed');
    return actionError('Sign-in could not be completed. Try again.');
  }

  // Outside the try: `redirect` works by throwing, and must not be caught.
  redirect(destination);
}

export async function signOutAction(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  await revokeSession(token);
  store.delete(SESSION_COOKIE);
  redirect('/sign-in');
}

const setPasswordInput = z.object({
  token: z.string().trim().min(1),
  password: z.string().min(1, 'Choose a password.'),
});

/**
 * The one landing page for both a first-time invite and an admin-issued reset
 * (`/set-password?token=...`). `consumePasswordToken` does not care which the
 * token was for, only that it is genuine, unused and unexpired.
 */
export async function setPasswordAction(
  _prev: ActionResult<never> | null,
  form: FormData,
): Promise<ActionResult<never>> {
  const parsed = setPasswordInput.safeParse({
    token: form.get('token'),
    password: form.get('password'),
  });
  if (!parsed.success) {
    return actionError('That link is missing something. Ask an admin for a new one.');
  }

  const strength = checkPasswordStrength(parsed.data.password);
  if (!strength.ok) {
    return actionError('Choose a stronger password.', { password: strength.problems });
  }

  const consumed = await consumePasswordToken(parsed.data.token);
  if (!consumed) {
    return actionError('That link has expired or was already used. Ask an admin for a new one.');
  }

  const passwordHash = await hashPassword(parsed.data.password);
  await db.user.update({ where: { id: consumed.userId }, data: { passwordHash } });
  // A reset invalidates every other session, in case the account was
  // compromised; an invite has none yet to revoke, so this is a no-op there.
  await revokeAllSessionsForUser(consumed.userId);

  const meta = await requestMeta();
  const session = await createSession(consumed.userId, meta);
  const store = await cookies();
  store.set(SESSION_COOKIE, session.token, sessionCookieOptions());

  redirect('/');
}
