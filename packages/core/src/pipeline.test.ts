import { describe, expect, it } from 'vitest';
import { addMonths, daysBetween, parseDateInput, toDateInput } from './dates';
import {
  effectiveMembershipStatus,
  isDueWithin,
  isOverdue,
  isRenewalDue,
  isStale,
  membershipEndDate,
  needsTier,
  stageChangeProblems,
  weightedAmount,
} from './pipeline';

const NOW = new Date('2027-03-15T10:30:00Z');
const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe('dates', () => {
  it('adds calendar months and clamps to a shorter month', () => {
    expect(addMonths(day('2027-01-31'), 1)).toEqual(day('2027-02-28'));
    expect(addMonths(day('2028-02-29'), 12)).toEqual(day('2029-02-28'));
    expect(addMonths(day('2027-11-15'), 3)).toEqual(day('2028-02-15'));
  });

  it('counts whole UTC days regardless of the time of day', () => {
    expect(daysBetween(NOW, day('2027-03-20'))).toBe(5);
    expect(daysBetween(NOW, day('2027-03-10'))).toBe(-5);
  });

  it('round-trips the value a date input uses, and rejects impossible dates', () => {
    expect(toDateInput(parseDateInput('2027-06-01'))).toBe('2027-06-01');
    expect(parseDateInput('2027-02-31')).toBeNull();
    expect(parseDateInput('06/01/2027')).toBeNull();
    expect(parseDateInput('')).toBeNull();
  });
});

describe('needsTier / stageChangeProblems', () => {
  it('requires a tier for a membership deal from the proposal onwards only', () => {
    expect(needsTier('CORPORATE_MEMBERSHIP', 'IN_DISCUSSION')).toBe(false);
    expect(needsTier('CORPORATE_MEMBERSHIP', 'PROPOSAL_SENT')).toBe(true);
    expect(needsTier('CORPORATE_MEMBERSHIP', 'NEGOTIATING')).toBe(true);
    expect(needsTier('CORPORATE_MEMBERSHIP', 'WON')).toBe(true);
    expect(needsTier('CORPORATE_MEMBERSHIP', 'LOST')).toBe(false);
    expect(needsTier('CORPORATE_MEMBERSHIP', 'ON_HOLD')).toBe(false);
    expect(needsTier('REFERRAL_REVENUE', 'WON')).toBe(false);
  });

  const base = {
    askType: 'CORPORATE_MEMBERSHIP' as const,
    tierId: null,
    amountMinor: null,
    from: 'IN_DISCUSSION' as const,
  };

  it('refuses a proposal on a membership deal without a tier', () => {
    expect(stageChangeProblems({ ...base, to: 'PROPOSAL_SENT' })).toEqual({
      tierId: ['Choose a membership tier first.'],
    });
    expect(
      stageChangeProblems({ ...base, tierId: 't', amountMinor: 5_000_000, to: 'PROPOSAL_SENT' }),
    ).toBeNull();
  });

  it('asks for a reason when a deal is lost', () => {
    expect(stageChangeProblems({ ...base, to: 'LOST' })?.lostReason).toBeDefined();
    expect(
      stageChangeProblems({ ...base, to: 'LOST', lostReason: '  ' })?.lostReason,
    ).toBeDefined();
    expect(stageChangeProblems({ ...base, to: 'LOST', lostReason: 'Budget cut' })).toBeNull();
  });

  it('treats a move to the same stage as a mistake', () => {
    expect(stageChangeProblems({ ...base, to: 'IN_DISCUSSION' })?.stage).toBeDefined();
  });
});

describe('follow-ups', () => {
  it('is overdue only once the due day has passed, and only while open', () => {
    expect(isOverdue({ stage: 'CONTACTED', nextActionDue: day('2027-03-14') }, NOW)).toBe(true);
    expect(isOverdue({ stage: 'CONTACTED', nextActionDue: day('2027-03-15') }, NOW)).toBe(false);
    expect(isOverdue({ stage: 'WON', nextActionDue: day('2027-03-01') }, NOW)).toBe(false);
    expect(isOverdue({ stage: 'LOST', nextActionDue: day('2027-03-01') }, NOW)).toBe(false);
    expect(isOverdue({ stage: 'ON_HOLD', nextActionDue: day('2027-03-01') }, NOW)).toBe(true);
    expect(isOverdue({ stage: 'CONTACTED', nextActionDue: null }, NOW)).toBe(false);
  });

  it('counts this week as the next seven days, overdue included', () => {
    expect(isDueWithin({ stage: 'PROSPECT', nextActionDue: day('2027-03-22') }, NOW, 7)).toBe(true);
    expect(isDueWithin({ stage: 'PROSPECT', nextActionDue: day('2027-03-23') }, NOW, 7)).toBe(
      false,
    );
    expect(isDueWithin({ stage: 'PROSPECT', nextActionDue: day('2027-01-01') }, NOW, 7)).toBe(true);
  });

  it('calls an open deal stale after the configured quiet period', () => {
    const touched = (iso: string) => ({
      stage: 'IN_DISCUSSION' as const,
      lastTouchedAt: new Date(iso),
    });
    expect(isStale(touched('2027-02-21T10:00:00Z'), NOW)).toBe(true); // 22 days
    expect(isStale(touched('2027-02-23T10:30:00Z'), NOW)).toBe(false); // 20 days
    expect(isStale(touched('2027-03-01T00:00:00Z'), NOW, 7)).toBe(true);
    expect(isStale({ stage: 'WON', lastTouchedAt: new Date('2026-01-01') }, NOW)).toBe(false);
  });

  it('weights open deals by stage and never weights closed ones', () => {
    expect(weightedAmount(5_000_000, 'PROPOSAL_SENT')).toBe(2_500_000);
    expect(weightedAmount(5_000_000, 'WON')).toBe(0);
    expect(weightedAmount(null, 'NEGOTIATING')).toBe(0);
  });
});

describe('memberships', () => {
  it('runs twelve months', () => {
    expect(membershipEndDate(day('2027-01-15'))).toEqual(day('2028-01-15'));
  });

  it('expires on read once the end date has passed', () => {
    const active = { status: 'ACTIVE' as const, endDate: day('2027-03-15') };
    expect(effectiveMembershipStatus(active, NOW)).toBe('ACTIVE');
    expect(effectiveMembershipStatus({ ...active, endDate: day('2027-03-14') }, NOW)).toBe(
      'EXPIRED',
    );
    expect(effectiveMembershipStatus({ ...active, status: 'CANCELLED' }, NOW)).toBe('CANCELLED');
  });

  it('flags renewals inside the notice window', () => {
    expect(isRenewalDue({ status: 'ACTIVE', endDate: day('2027-05-14') }, NOW, 60)).toBe(true);
    expect(isRenewalDue({ status: 'ACTIVE', endDate: day('2027-05-15') }, NOW, 60)).toBe(false);
    expect(isRenewalDue({ status: 'ACTIVE', endDate: day('2027-03-01') }, NOW, 60)).toBe(false);
    expect(isRenewalDue({ status: 'CANCELLED', endDate: day('2027-04-01') }, NOW, 60)).toBe(false);
  });
});
