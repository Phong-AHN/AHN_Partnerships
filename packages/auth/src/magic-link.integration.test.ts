import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '@partners/db';
import { consumeLoginToken, createLoginToken } from './login-token';
import { completeSignIn, prepareSignInLink } from './magic-link';
import { recordSignInAttempt } from './rate-limit';

const userIds: string[] = [];

async function makeUser(overrides: { isActive?: boolean } = {}) {
  const user = await db.user.create({
    data: {
      email: `it-link-${randomUUID().slice(0, 8)}@partners.test`,
      name: 'Link Test User',
      role: 'MEMBER',
      isActive: overrides.isActive ?? true,
    },
  });
  userIds.push(user.id);
  return user;
}

const ip = () => `test-${randomUUID()}`;

afterEach(async () => {
  await db.signInThrottle.deleteMany({ where: { ip: { startsWith: 'test-' } } });
  if (userIds.length > 0) {
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    userIds.length = 0;
  }
});

describe('login tokens', () => {
  it('consume exactly once, carrying their purpose', async () => {
    const user = await makeUser();
    const { token } = await createLoginToken(user.id, 'INVITE');
    expect(await consumeLoginToken(token)).toEqual({ userId: user.id, purpose: 'INVITE' });
    expect(await consumeLoginToken(token)).toBeNull();
  });

  it('refuse an expired token and one nobody issued', async () => {
    const user = await makeUser();
    const { token } = await createLoginToken(user.id, 'SIGN_IN');
    await db.loginToken.updateMany({
      where: { userId: user.id },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });
    expect(await consumeLoginToken(token)).toBeNull();
    expect(await consumeLoginToken('not-a-real-token')).toBeNull();
  });

  it('give an invite a week and a sign-in link a quarter of an hour', async () => {
    const user = await makeUser();
    const invite = await createLoginToken(user.id, 'INVITE');
    const signIn = await createLoginToken(user.id, 'SIGN_IN');
    const minutes = (d: Date) => Math.round((d.getTime() - Date.now()) / 60_000);
    expect(minutes(invite.expiresAt)).toBeGreaterThan(7 * 24 * 60 - 2);
    expect(minutes(signIn.expiresAt)).toBeLessThanOrEqual(15);
  });
});

describe('magic-link sign-in', () => {
  it('issues a link to an active account and signs in with it once', async () => {
    const user = await makeUser();
    const link = await prepareSignInLink(` ${user.email.toUpperCase()} `, { ip: ip() });
    expect(link).toMatchObject({ userId: user.id, email: user.email });

    const signedIn = await completeSignIn(link!.token, { ip: ip() });
    expect(signedIn?.userId).toBe(user.id);
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: user.id } })).lastLoginAt,
    ).not.toBeNull();
    expect(await completeSignIn(link!.token)).toBeNull();
  });

  it('answers an unknown address and a deactivated account with nothing', async () => {
    expect(await prepareSignInLink('nobody-here@partners.test', { ip: ip() })).toBeNull();
    const inactive = await makeUser({ isActive: false });
    expect(await prepareSignInLink(inactive.email, { ip: ip() })).toBeNull();
  });

  it('will not send a second link within the cooldown', async () => {
    const user = await makeUser();
    expect(await prepareSignInLink(user.email, { ip: ip() })).not.toBeNull();
    expect(await prepareSignInLink(user.email, { ip: ip() })).toBeNull();
  });

  it('refuses a link for an account deactivated after it was sent', async () => {
    const user = await makeUser();
    const link = await prepareSignInLink(user.email, { ip: ip() });
    await db.user.update({ where: { id: user.id }, data: { isActive: false } });
    expect(await completeSignIn(link!.token)).toBeNull();
  });

  it('slows down an IP that keeps asking, and a completed sign-in clears it', async () => {
    const user = await makeUser();
    const source = ip();
    for (let i = 0; i < 6; i += 1) await recordSignInAttempt(source);
    await expect(prepareSignInLink(user.email, { ip: source })).rejects.toThrow(/Too many/);

    await db.signInThrottle.update({
      where: { ip: source },
      data: { lastAttemptAt: new Date(Date.now() - 60_000) },
    });
    const link = await prepareSignInLink(user.email, { ip: source });
    await completeSignIn(link!.token, { ip: source });
    expect(await db.signInThrottle.findUnique({ where: { ip: source } })).toBeNull();
  });
});
