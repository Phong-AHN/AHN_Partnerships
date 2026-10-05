import { env } from '@partners/config';
import { AppError, renderInviteEmail, renderSignInEmail, type RenderedEmail } from '@partners/core';
import { logger } from '@partners/observability';

/**
 * Outgoing email, through Resend's REST API (https://resend.com/docs/api-reference/emails/send-email).
 * A plain `fetch` - one endpoint does not need an SDK.
 *
 * Without `RESEND_API_KEY` (local development) nothing is sent: the message
 * is printed to the server log so the link can still be clicked. Production
 * refuses to boot without the key (see `@partners/config`). Under test,
 * messages land in an in-memory outbox the tests read back.
 */

export interface SentEmail extends RenderedEmail {
  to: string;
}

const testOutbox: SentEmail[] = [];

/** Test hook: returns and clears what would have been sent. */
export function takeSentEmails(): SentEmail[] {
  return testOutbox.splice(0, testOutbox.length);
}

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

export async function sendEmail(to: string, email: RenderedEmail): Promise<void> {
  const config = env();

  if (config.NODE_ENV === 'test') {
    testOutbox.push({ to, ...email });
    return;
  }
  if (!config.RESEND_API_KEY) {
    console.info(
      `\n[email] RESEND_API_KEY is not set - not sent, printed instead.\nTo: ${to}\nSubject: ${email.subject}\n\n${email.text}`,
    );
    return;
  }

  const response = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: config.EMAIL_FROM,
      to: [to],
      subject: email.subject,
      html: email.html,
      text: email.text,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    // Resend explains itself in the body ("domain not verified", ...): log it,
    // never show it to the user.
    const detail = await response.text().catch(() => '');
    logger.error({ status: response.status, detail: detail.slice(0, 500) }, 'resend send failed');
    throw new AppError('INTEGRATION_UNAVAILABLE', 503, 'The email could not be sent right now.', {
      provider: 'resend',
      status: response.status,
    });
  }
}

/**
 * The link a person clicks. Always built from `APP_URL`, never from the
 * request's Host header - a forged Host would otherwise put an attacker's
 * domain in a real sign-in email.
 */
export function signInUrl(token: string, next?: string | null): string {
  const url = new URL('/sign-in/verify', env().APP_URL);
  url.searchParams.set('token', token);
  if (next && next.startsWith('/') && !next.startsWith('//')) url.searchParams.set('next', next);
  return url.toString();
}

function minutesUntil(date: Date): number {
  return Math.max(1, Math.round((date.getTime() - Date.now()) / 60_000));
}

export async function sendSignInEmail(input: {
  to: string;
  name: string;
  token: string;
  expiresAt: Date;
  next?: string | null;
}): Promise<void> {
  await sendEmail(
    input.to,
    renderSignInEmail({
      name: input.name,
      url: signInUrl(input.token, input.next),
      minutes: minutesUntil(input.expiresAt),
    }),
  );
}

export async function sendInviteEmail(input: {
  to: string;
  name: string;
  inviterName: string;
  token: string;
  expiresAt: Date;
}): Promise<void> {
  await sendEmail(
    input.to,
    renderInviteEmail({
      name: input.name,
      inviterName: input.inviterName,
      url: signInUrl(input.token),
      days: Math.round(minutesUntil(input.expiresAt) / (60 * 24)),
    }),
  );
}
