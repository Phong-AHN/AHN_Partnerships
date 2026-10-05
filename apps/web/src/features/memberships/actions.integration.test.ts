import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fixedClock, resetClock, setClock } from '@partners/core';
import { db } from '@partners/db';
import {
  actAs,
  cleanupFixtures,
  createTestPartner,
  createTestTier,
  createTestUser,
  type TestUser,
} from '../../../test/fixtures';
import { createDealAction, moveStageAction } from '../deals/actions';
import { cancelMembershipAction, markPaidAction, renewMembershipAction } from './actions';
import { listMemberships } from './queries';

let member: TestUser;

beforeAll(async () => {
  member = await createTestUser('MEMBER');
});
afterAll(async () => {
  resetClock();
  await cleanupFixtures();
});

async function wonMembership(tierName?: string, start = '2027-01-01') {
  const tier = await createTestTier(2_500_000, 2027);
  if (tierName)
    await db.membershipTier.update({ where: { id: tier.id }, data: { name: tierName } });
  const partner = await createTestPartner();
  actAs(member);
  const deal = await createDealAction({
    partnerId: partner.id,
    askType: 'CORPORATE_MEMBERSHIP',
    tierId: tier.id,
    stage: 'NEGOTIATING',
    year: '2027',
  });
  if (!deal.ok) throw new Error(deal.error);
  await moveStageAction({ id: deal.data.id, stage: 'WON', startDate: start });
  const membership = await db.membership.findUniqueOrThrow({ where: { dealId: deal.data.id } });
  return { tier, partner, dealId: deal.data.id, membership };
}

describe('memberships (phase 5)', () => {
  it('marks paid and unpaid', async () => {
    const { membership } = await wonMembership();
    expect(
      (await markPaidAction({ id: membership.id, paid: 'true', paidOn: '2026-09-20' })).ok,
    ).toBe(true);
    expect(
      (await db.membership.findUniqueOrThrow({ where: { id: membership.id } })).paidAt,
    ).toEqual(new Date('2026-09-20T00:00:00Z'));
    await markPaidAction({ id: membership.id, paid: false });
    expect(
      (await db.membership.findUniqueOrThrow({ where: { id: membership.id } })).paidAt,
    ).toBeNull();
  });

  it('cancels with a reason that lands in the notes and the timeline', async () => {
    const { membership, partner } = await wonMembership();
    expect(
      (await cancelMembershipAction({ id: membership.id, reason: 'Merged with parent company' }))
        .ok,
    ).toBe(true);
    const after = await db.membership.findUniqueOrThrow({ where: { id: membership.id } });
    expect(after.status).toBe('CANCELLED');
    expect(after.notes).toMatch(/Merged with parent company/);
    const notes = await db.activity.findMany({ where: { partnerId: partner.id, type: 'NOTE' } });
    expect(notes.map((n) => n.body).join()).toMatch(/cancelled: Merged/);
    expect(await cancelMembershipAction({ id: membership.id })).toMatchObject({
      ok: false,
      code: 'CONFLICT',
    });
  });

  it('renews into next year at IN_DISCUSSION, picking up next year’s tier of the same name', async () => {
    const name = `Renewable ${Date.now()}`;
    const { membership, partner } = await wonMembership(name);
    const nextYear = await createTestTier(3_000_000, 2028);
    await db.membershipTier.update({ where: { id: nextYear.id }, data: { name } });

    const result = await renewMembershipAction({ id: membership.id });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(await db.deal.findUniqueOrThrow({ where: { id: result.data.dealId } })).toMatchObject({
      partnerId: partner.id,
      year: 2028,
      askType: 'CORPORATE_MEMBERSHIP',
      stage: 'IN_DISCUSSION',
      tierId: nextYear.id,
      amountMinor: 3_000_000,
      title: '2028 Corporate Membership (renewal)',
    });

    // A second click does not open a second renewal.
    expect(await renewMembershipAction({ id: membership.id })).toMatchObject({
      ok: false,
      code: 'CONFLICT',
    });
  });

  it('keeps the same tier when next year has no tier of that name', async () => {
    const { membership, tier } = await wonMembership();
    const result = await renewMembershipAction({ id: membership.id });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(await db.deal.findUniqueOrThrow({ where: { id: result.data.dealId } })).toMatchObject({
      year: 2028,
      tierId: tier.id,
      amountMinor: 2_500_000,
    });
  });

  it('derives EXPIRED on read and lists renewals inside the notice window', async () => {
    const { membership } = await wonMembership(undefined, '2027-01-01'); // ends 2028-01-01

    setClock(fixedClock('2027-12-01T12:00:00Z'));
    const renewals = await listMemberships('renewals', new Date('2027-12-01T12:00:00Z'), 60);
    expect(renewals.find((row) => row.id === membership.id)).toMatchObject({
      effectiveStatus: 'ACTIVE',
      renewalDue: true,
      daysLeft: 31,
    });

    const later = new Date('2028-02-01T12:00:00Z');
    const expired = await listMemberships('expired', later, 60);
    expect(expired.find((row) => row.id === membership.id)?.effectiveStatus).toBe('EXPIRED');
    const active = await listMemberships('active', later, 60);
    expect(active.some((row) => row.id === membership.id)).toBe(false);
    // Stored status never changed - nothing had to run on a schedule.
    expect((await db.membership.findUniqueOrThrow({ where: { id: membership.id } })).status).toBe(
      'ACTIVE',
    );
    resetClock();
  });

  it('keeps a viewer out', async () => {
    const { membership } = await wonMembership();
    actAs(await createTestUser('VIEWER'));
    for (const result of await Promise.all([
      markPaidAction({ id: membership.id, paid: 'true' }),
      cancelMembershipAction({ id: membership.id }),
      renewMembershipAction({ id: membership.id }),
    ])) {
      expect(result).toMatchObject({ ok: false, code: 'FORBIDDEN' });
    }
  });
});
