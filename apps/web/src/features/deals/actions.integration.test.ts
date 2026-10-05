import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { db } from '@partners/db';
import {
  actAs,
  cleanupFixtures,
  createTestPartner,
  createTestTier,
  createTestUser,
  type TestUser,
} from '../../../test/fixtures';
import {
  assignTierAction,
  createDealAction,
  moveStageAction,
  setNextActionAction,
  updateDealAction,
} from './actions';

let member: TestUser;

beforeAll(async () => {
  member = await createTestUser('MEMBER');
});
afterAll(cleanupFixtures);

async function newDeal(data: Record<string, unknown> = {}) {
  const partner = await createTestPartner();
  actAs(member);
  const result = await createDealAction({
    partnerId: partner.id,
    askType: 'CORPORATE_MEMBERSHIP',
    ...data,
  });
  if (!result.ok)
    throw new Error(`createDeal failed: ${result.error} ${JSON.stringify(result.fieldErrors)}`);
  return { partner, dealId: result.data.id };
}

describe('moveStage (phase 4 acceptance)', () => {
  it('moving a priced membership deal from PROPOSAL_SENT to WON creates the membership', async () => {
    const platinum = await createTestTier(5_000_000);
    const { partner, dealId } = await newDeal({ tierId: platinum.id, stage: 'PROPOSAL_SENT' });

    const result = await moveStageAction({ id: dealId, stage: 'WON', startDate: '2027-01-15' });
    expect(result.ok).toBe(true);

    const deal = await db.deal.findUniqueOrThrow({
      where: { id: dealId },
      include: { membership: true },
    });
    expect(deal.stage).toBe('WON');
    expect(deal.closedAt).not.toBeNull();
    expect(deal.membership).toMatchObject({
      partnerId: partner.id,
      tierId: platinum.id,
      amountMinor: 5_000_000,
      status: 'ACTIVE',
      startDate: new Date('2027-01-15T00:00:00Z'),
      endDate: new Date('2028-01-15T00:00:00Z'),
    });

    const activity = await db.activity.findMany({
      where: { dealId },
      orderBy: { occurredAt: 'asc' },
    });
    expect(activity.map((a) => a.type)).toEqual(
      expect.arrayContaining(['DEAL_CREATED', 'MEMBERSHIP_STARTED', 'STAGE_CHANGE']),
    );
    expect(activity.find((a) => a.type === 'STAGE_CHANGE')?.body).toBe('Proposal sent → Won');
  });

  it('refuses a proposal on a membership deal without a tier - as a field error, not a 23514', async () => {
    const { dealId } = await newDeal({ stage: 'IN_DISCUSSION' });
    const result = await moveStageAction({ id: dealId, stage: 'PROPOSAL_SENT' });
    expect(result).toMatchObject({
      ok: false,
      fieldErrors: { tierId: ['Choose a membership tier first.'] },
    });
    expect((await db.deal.findUniqueOrThrow({ where: { id: dealId } })).stage).toBe(
      'IN_DISCUSSION',
    );
  });

  it('can pick the tier and move in one step', async () => {
    const gold = await createTestTier(2_500_000);
    const { dealId } = await newDeal({ stage: 'IN_DISCUSSION' });
    expect(
      (await moveStageAction({ id: dealId, stage: 'PROPOSAL_SENT', tierId: gold.id })).ok,
    ).toBe(true);
    expect(await db.deal.findUniqueOrThrow({ where: { id: dealId } })).toMatchObject({
      stage: 'PROPOSAL_SENT',
      tierId: gold.id,
      amountMinor: 2_500_000,
    });
  });

  it('needs a reason to lose a deal, and clears it when reopened', async () => {
    const { dealId } = await newDeal({ askType: 'REFERRAL_REVENUE', stage: 'CONTACTED' });
    expect(await moveStageAction({ id: dealId, stage: 'LOST' })).toMatchObject({
      ok: false,
      fieldErrors: { lostReason: expect.any(Array) },
    });
    expect(
      (await moveStageAction({ id: dealId, stage: 'LOST', lostReason: 'No budget in 2027' })).ok,
    ).toBe(true);
    expect(await db.deal.findUniqueOrThrow({ where: { id: dealId } })).toMatchObject({
      stage: 'LOST',
      lostReason: 'No budget in 2027',
      closedAt: expect.any(Date),
    });

    expect((await moveStageAction({ id: dealId, stage: 'IN_DISCUSSION' })).ok).toBe(true);
    expect(await db.deal.findUniqueOrThrow({ where: { id: dealId } })).toMatchObject({
      stage: 'IN_DISCUSSION',
      lostReason: null,
      closedAt: null,
    });
  });

  it('will not reopen a won deal while its membership is live', async () => {
    const tier = await createTestTier(1_000_000);
    const { dealId } = await newDeal({ tierId: tier.id, stage: 'NEGOTIATING' });
    await moveStageAction({ id: dealId, stage: 'WON' });
    const membership = await db.membership.findUniqueOrThrow({ where: { dealId } });

    expect(await moveStageAction({ id: dealId, stage: 'NEGOTIATING' })).toMatchObject({
      ok: false,
      code: 'CONFLICT',
      error: expect.stringMatching(/Cancel the membership/),
    });

    await db.membership.update({ where: { id: membership.id }, data: { status: 'CANCELLED' } });
    expect((await moveStageAction({ id: dealId, stage: 'NEGOTIATING' })).ok).toBe(true);
    // The cancelled membership stays as history, detached from the deal.
    expect(
      (await db.membership.findUniqueOrThrow({ where: { id: membership.id } })).dealId,
    ).toBeNull();
    // ...so the deal can be won again.
    expect((await moveStageAction({ id: dealId, stage: 'WON' })).ok).toBe(true);
    expect(
      await db.membership.count({
        where: {
          partnerId: (await db.deal.findUniqueOrThrow({ where: { id: dealId } })).partnerId,
        },
      }),
    ).toBe(2);
  });

  it('a won referral deal creates no membership', async () => {
    const { dealId } = await newDeal({
      askType: 'REFERRAL_REVENUE',
      amount: '12,000',
      stage: 'NEGOTIATING',
    });
    expect(await moveStageAction({ id: dealId, stage: 'WON' })).toMatchObject({
      ok: true,
      data: { membershipId: null },
    });
    expect(await db.membership.count({ where: { dealId } })).toBe(0);
  });
});

describe('tier pricing is a snapshot', () => {
  it('copies the tier price at assignment and ignores later price changes', async () => {
    const tier = await createTestTier(2_500_000);
    const { dealId } = await newDeal();
    expect((await assignTierAction({ id: dealId, tierId: tier.id })).ok).toBe(true);
    expect((await db.deal.findUniqueOrThrow({ where: { id: dealId } })).amountMinor).toBe(
      2_500_000,
    );

    await db.membershipTier.update({ where: { id: tier.id }, data: { priceMinor: 3_000_000 } });
    // Saving the deal with the same tier keeps the snapshot.
    await updateDealAction({
      id: dealId,
      title: 'Renamed',
      askType: 'CORPORATE_MEMBERSHIP',
      tierId: tier.id,
      year: 2027,
    });
    expect(await db.deal.findUniqueOrThrow({ where: { id: dealId } })).toMatchObject({
      title: 'Renamed',
      amountMinor: 2_500_000,
    });

    // Re-assigning re-snapshots.
    await assignTierAction({ id: dealId, tierId: tier.id });
    const other = await createTestTier(1_000_000);
    await assignTierAction({ id: dealId, tierId: other.id });
    expect((await db.deal.findUniqueOrThrow({ where: { id: dealId } })).amountMinor).toBe(
      1_000_000,
    );
  });

  it('never takes a typed amount for a membership deal', async () => {
    const { dealId } = await newDeal({ amount: '999' });
    expect((await db.deal.findUniqueOrThrow({ where: { id: dealId } })).amountMinor).toBeNull();
  });

  it('will not clear the tier of a deal that needs one', async () => {
    const tier = await createTestTier();
    const { dealId } = await newDeal({ tierId: tier.id, stage: 'PROPOSAL_SENT' });
    expect(await assignTierAction({ id: dealId })).toMatchObject({
      ok: false,
      fieldErrors: { tierId: expect.any(Array) },
    });
  });
});

describe('creating and following up', () => {
  it('names the deal after its year and ask when no title is given', async () => {
    const { dealId } = await newDeal({ askType: 'STRATEGIC_COMMUNITY', year: '2028' });
    expect((await db.deal.findUniqueOrThrow({ where: { id: dealId } })).title).toBe(
      '2028 Strategic / Community Partnership',
    );
  });

  it('refuses to create a deal already closed', async () => {
    const partner = await createTestPartner();
    actAs(member);
    expect(
      await createDealAction({ partnerId: partner.id, askType: 'REFERRAL_REVENUE', stage: 'WON' }),
    ).toMatchObject({
      ok: false,
      fieldErrors: { stage: expect.any(Array) },
    });
  });

  it('sets and clears the next action', async () => {
    const { dealId } = await newDeal();
    await setNextActionAction({ id: dealId, nextAction: 'Send deck', nextActionDue: '2027-02-01' });
    expect(await db.deal.findUniqueOrThrow({ where: { id: dealId } })).toMatchObject({
      nextAction: 'Send deck',
      nextActionDue: new Date('2027-02-01T00:00:00Z'),
    });
    await setNextActionAction({ id: dealId });
    expect(await db.deal.findUniqueOrThrow({ where: { id: dealId } })).toMatchObject({
      nextAction: null,
      nextActionDue: null,
    });
  });

  it('keeps a viewer from moving deals', async () => {
    const { dealId } = await newDeal({ askType: 'REFERRAL_REVENUE' });
    actAs(await createTestUser('VIEWER'));
    expect(await moveStageAction({ id: dealId, stage: 'CONTACTED' })).toMatchObject({
      ok: false,
      code: 'FORBIDDEN',
    });
  });
});
