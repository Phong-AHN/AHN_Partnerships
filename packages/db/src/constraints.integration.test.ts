import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { db, isCheckConstraintViolation } from './index';

/**
 * The check constraints written by hand in the `init` migration. The server
 * actions check the same rules first; these prove the database refuses a
 * write that slipped past them anyway.
 */
describe('check constraints', () => {
  const suffix = randomUUID().slice(0, 8);
  let partnerId: string;
  let tierId: string;

  beforeAll(async () => {
    const partner = await db.partner.create({
      data: { name: `IT Constraint Partner ${suffix}`, sector: 'TECH_COMMERCE_SMB' },
    });
    partnerId = partner.id;
    const tier = await db.membershipTier.create({
      data: { code: `IT_${suffix}`, name: `IT Tier ${suffix}`, year: 2027, priceMinor: 100_000 },
    });
    tierId = tier.id;
  });

  afterAll(async () => {
    await db.partner.deleteMany({ where: { id: partnerId } });
    await db.membershipTier.deleteMany({ where: { id: tierId } });
  });

  const deal = (data: Record<string, unknown>) =>
    db.deal.create({
      data: {
        partnerId,
        title: 'IT deal',
        askType: 'CORPORATE_MEMBERSHIP',
        ...data,
      } as Parameters<typeof db.deal.create>[0]['data'],
    });

  async function expectViolation(write: Promise<unknown>, constraint: string) {
    const error = await write.then(
      () => null,
      (caught: unknown) => caught,
    );
    expect(error, `expected ${constraint} to refuse the write`).not.toBeNull();
    expect(isCheckConstraintViolation(error, constraint)).toBe(true);
  }

  it('lets an early membership deal go without a tier', async () => {
    for (const stage of ['PROSPECT', 'CONTACTED', 'IN_DISCUSSION', 'ON_HOLD'] as const) {
      await expect(deal({ stage })).resolves.toBeTruthy();
    }
  });

  it('refuses a membership proposal with no tier or no price', async () => {
    await expectViolation(deal({ stage: 'PROPOSAL_SENT' }), 'Deal_membership_needs_tier');
    await expectViolation(deal({ stage: 'NEGOTIATING', tierId }), 'Deal_membership_needs_tier');
    await expect(
      deal({ stage: 'PROPOSAL_SENT', tierId, amountMinor: 100_000 }),
    ).resolves.toBeTruthy();
  });

  it('does not ask a referral deal for a tier', async () => {
    await expect(deal({ askType: 'REFERRAL_REVENUE', stage: 'NEGOTIATING' })).resolves.toBeTruthy();
  });

  it('refuses a closed deal without a close time', async () => {
    await expectViolation(
      deal({ askType: 'REFERRAL_REVENUE', stage: 'LOST' }),
      'Deal_closed_has_timestamp',
    );
    await expect(
      deal({ askType: 'REFERRAL_REVENUE', stage: 'LOST', closedAt: new Date('2027-01-01') }),
    ).resolves.toBeTruthy();
  });

  it('refuses a negative amount', async () => {
    await expectViolation(
      deal({ askType: 'REFERRAL_REVENUE', amountMinor: -1 }),
      'Deal_amount_non_negative',
    );
  });

  it('refuses a membership that ends before it starts', async () => {
    const membership = (startDate: string, endDate: string) =>
      db.membership.create({
        data: {
          partnerId,
          tierId,
          amountMinor: 100_000,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
        },
      });
    await expectViolation(membership('2027-01-01', '2027-01-01'), 'Membership_end_after_start');
    await expectViolation(membership('2027-01-01', '2026-01-01'), 'Membership_end_after_start');
    await expect(membership('2027-01-01', '2028-01-01')).resolves.toBeTruthy();
  });
});
