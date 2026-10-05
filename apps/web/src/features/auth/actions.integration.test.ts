import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@partners/db';
import { cleanupFixtures, createTestUser } from '../../../test/fixtures';
import { withHeaders } from '../../../test/request-context';
import { takeSentEmails } from '@/server/email';
import { requestSignInLinkAction, verifySignInAction } from './actions';

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

function linkIn(text: string): URL {
  return new URL(/https?:\/\/\S+/.exec(text)?.[0] ?? 'http://invalid');
}

beforeEach(() => {
  // A fresh source IP per test, so the throttle from one test never slows another.
  withHeaders({ 'x-forwarded-for': `test-${randomUUID()}` });
  takeSentEmails();
});

afterAll(async () => {
  await db.signInThrottle.deleteMany({ where: { ip: { startsWith: 'test-' } } });
  await cleanupFixtures();
});

describe('magic-link sign-in', () => {
  it('emails a link that signs the person in, then lands on the requested page', async () => {
    const user = await createTestUser('MEMBER');
    const requested = await requestSignInLinkAction(
      null,
      form({ email: user.email, next: '/pipeline' }),
    );
    expect(requested).toMatchObject({
      ok: true,
      message: expect.stringMatching(/sign-in link is on its way/),
    });

    const [sent, ...rest] = takeSentEmails();
    expect(rest).toEqual([]);
    expect(sent?.to).toBe(user.email);
    const link = linkIn(sent!.text);
    expect(link.pathname).toBe('/sign-in/verify');
    expect(link.searchParams.get('next')).toBe('/pipeline');

    const sessionsBefore = await db.session.count({ where: { userId: user.id } });
    // A successful verify ends in a redirect, which the test harness turns into an error.
    await expect(
      verifySignInAction(null, form({ token: link.searchParams.get('token')!, next: '/pipeline' })),
    ).rejects.toThrow('Unexpected redirect to /pipeline');
    expect(await db.session.count({ where: { userId: user.id } })).toBe(sessionsBefore + 1);

    // The same link a second time is refused.
    expect(
      await verifySignInAction(null, form({ token: link.searchParams.get('token')! })),
    ).toMatchObject({
      ok: false,
      error: expect.stringMatching(/expired or was already used/),
    });
  });

  it('answers an unknown address exactly like a known one, and sends nothing', async () => {
    const result = await requestSignInLinkAction(
      null,
      form({ email: 'nobody-at-all@partners.test' }),
    );
    expect(result).toMatchObject({
      ok: true,
      message: expect.stringMatching(/If that address has an account/),
    });
    expect(takeSentEmails()).toEqual([]);
  });

  it('never carries an off-site next into the link', async () => {
    const user = await createTestUser('VIEWER');
    await requestSignInLinkAction(null, form({ email: user.email, next: '//evil.example/x' }));
    expect(linkIn(takeSentEmails()[0]!.text).searchParams.get('next')).toBeNull();
  });

  it('asks for a valid address', async () => {
    expect(await requestSignInLinkAction(null, form({ email: 'not-an-email' }))).toMatchObject({
      ok: false,
      fieldErrors: { email: expect.any(Array) },
    });
  });
});
