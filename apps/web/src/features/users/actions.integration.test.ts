import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { consumePasswordToken } from '@partners/auth';
import { db } from '@partners/db';
import { actAs, cleanupFixtures, createTestUser } from '../../../test/fixtures';
import { getSettings } from '../settings/service';
import { updateSettingsAction } from '../settings/actions';
import { createTierAction, updateTierAction } from '../tiers/actions';
import { inviteUserAction, resetLinkAction, updateUserAction } from './actions';

const invitedEmails: string[] = [];
const tierIds: string[] = [];

afterAll(async () => {
  await db.user.deleteMany({ where: { email: { in: invitedEmails } } });
  await db.membershipTier.deleteMany({ where: { id: { in: tierIds } } });
  await cleanupFixtures();
});

describe('users', () => {
  it('invites with a one-time set-password link', async () => {
    actAs(await createTestUser('ADMIN'));
    const email = `it-invite-${randomUUID().slice(0, 8)}@partners.test`;
    invitedEmails.push(email);
    const result = await inviteUserAction({
      name: 'New Person',
      email: email.toUpperCase(),
      role: 'MEMBER',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const token = new URL(result.data.link).searchParams.get('token')!;
    const user = await db.user.findUniqueOrThrow({ where: { email } });
    expect(await consumePasswordToken(token)).toEqual({ userId: user.id, purpose: 'INVITE' });

    expect(await inviteUserAction({ name: 'Again', email, role: 'MEMBER' })).toMatchObject({
      ok: false,
      fieldErrors: { email: expect.any(Array) },
    });
  });

  it('issues reset links and deactivates, revoking sessions', async () => {
    actAs(await createTestUser('ADMIN'));
    const target = await createTestUser('MEMBER');
    const reset = await resetLinkAction({ id: target.id });
    expect(reset.ok && reset.data.link).toMatch(/\/set-password\?token=/);

    expect((await updateUserAction({ id: target.id, name: target.name, role: 'VIEWER' })).ok).toBe(
      true,
    );
    const after = await db.user.findUniqueOrThrow({ where: { id: target.id } });
    expect(after).toMatchObject({ role: 'VIEWER', isActive: false });
    expect(await db.session.count({ where: { userId: target.id, revokedAt: null } })).toBe(0);
  });

  it('will not let an admin demote or deactivate themselves', async () => {
    const admin = await createTestUser('ADMIN');
    actAs(admin);
    expect(
      await updateUserAction({ id: admin.id, name: admin.name, role: 'MEMBER', isActive: 'on' }),
    ).toMatchObject({
      ok: false,
      fieldErrors: { role: expect.any(Array) },
    });
  });

  it('is admin only', async () => {
    actAs(await createTestUser('MEMBER'));
    expect(
      await inviteUserAction({ name: 'X', email: 'x@partners.test', role: 'ADMIN' }),
    ).toMatchObject({
      ok: false,
      code: 'FORBIDDEN',
    });
  });
});

describe('tiers', () => {
  it('creates a tier with a derived code and refuses a duplicate name for the year', async () => {
    actAs(await createTestUser('ADMIN'));
    const name = `Diamond ${randomUUID().slice(0, 6)}`;
    const created = await createTierAction({
      name,
      year: '2028',
      price: '$75,000',
      benefits: '- Keynote\n- Booth\n\n',
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    tierIds.push(created.data.id);
    expect(
      await db.membershipTier.findUniqueOrThrow({ where: { id: created.data.id } }),
    ).toMatchObject({
      code: `${name.toUpperCase().replace(/ /g, '_')}_2028`,
      priceMinor: 7_500_000,
      benefits: ['Keynote', 'Booth'],
      isActive: false,
    });

    expect(
      await createTierAction({ name: name.toLowerCase(), year: '2028', price: '1' }),
    ).toMatchObject({
      ok: false,
      fieldErrors: { name: expect.any(Array) },
    });
    expect(
      (
        await updateTierAction({
          id: created.data.id,
          name,
          year: '2028',
          price: '80000',
          isActive: 'on',
        })
      ).ok,
    ).toBe(true);
    expect(
      (await db.membershipTier.findUniqueOrThrow({ where: { id: created.data.id } })).priceMinor,
    ).toBe(8_000_000);
  });

  it('is admin only', async () => {
    actAs(await createTestUser('MEMBER'));
    expect(await createTierAction({ name: 'Nope', year: '2027', price: '1' })).toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});

describe('settings', () => {
  it('saves the target and thresholds, and clears the target when left empty', async () => {
    actAs(await createTestUser('ADMIN'));
    const before = await getSettings();
    try {
      expect(
        (
          await updateSettingsAction({
            annualTarget: '750,000',
            renewalNoticeDays: '45',
            staleDays: '14',
          })
        ).ok,
      ).toBe(true);
      expect(await getSettings()).toEqual({
        annualTargetMinor: 75_000_000,
        renewalNoticeDays: 45,
        staleDays: 14,
      });
      await updateSettingsAction({ renewalNoticeDays: '45', staleDays: '14' });
      expect((await getSettings()).annualTargetMinor).toBeNull();
      expect(await updateSettingsAction({ renewalNoticeDays: '0', staleDays: 'x' })).toMatchObject({
        ok: false,
        fieldErrors: { renewalNoticeDays: expect.any(Array), staleDays: expect.any(Array) },
      });
    } finally {
      await updateSettingsAction({
        annualTarget:
          before.annualTargetMinor === null ? undefined : String(before.annualTargetMinor / 100),
        renewalNoticeDays: String(before.renewalNoticeDays),
        staleDays: String(before.staleDays),
      });
    }
  });
});
