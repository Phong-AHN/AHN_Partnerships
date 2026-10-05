import type { AskType, DealStage, MembershipStatus } from './enums';
import { addDays, addMonths, startOfUtcDay } from './dates';

/**
 * The pipeline's rules as pure functions. Server actions, queries and the UI
 * all ask these, so "overdue" or "needs a tier" cannot mean one thing on the
 * board and another in the action that refuses the move.
 */

export const MEMBERSHIP_TERM_MONTHS = 12;
export const DEFAULT_RENEWAL_NOTICE_DAYS = 60;
export const DEFAULT_STALE_DAYS = 21;
export const DEFAULT_YEAR = 2027;

/** Board column order. */
export const PIPELINE_STAGES: readonly DealStage[] = [
  'PROSPECT',
  'CONTACTED',
  'IN_DISCUSSION',
  'PROPOSAL_SENT',
  'NEGOTIATING',
  'WON',
  'LOST',
  'ON_HOLD',
];

export const CLOSED_STAGES: readonly DealStage[] = ['WON', 'LOST'];
export const OPEN_STAGES: readonly DealStage[] = PIPELINE_STAGES.filter(
  (stage) => !CLOSED_STAGES.includes(stage),
);

/**
 * From a proposal onwards a membership deal must name its tier (and so carry
 * the tier's price). Mirrors the `Deal_membership_needs_tier` check
 * constraint - the constraint is the safety net, this is where the user hears
 * about it.
 */
export const TIER_REQUIRED_STAGES: readonly DealStage[] = ['PROPOSAL_SENT', 'NEGOTIATING', 'WON'];

/**
 * Rough odds of closing from each stage, for the weighted pipeline total on
 * the dashboard. WON is booked revenue and counted separately, never weighted.
 */
export const STAGE_PROBABILITY: Record<DealStage, number> = {
  PROSPECT: 0.05,
  CONTACTED: 0.1,
  IN_DISCUSSION: 0.25,
  PROPOSAL_SENT: 0.5,
  NEGOTIATING: 0.75,
  WON: 1,
  LOST: 0,
  ON_HOLD: 0.05,
};

export function isClosedStage(stage: DealStage): boolean {
  return CLOSED_STAGES.includes(stage);
}

export function needsTier(askType: AskType, stage: DealStage): boolean {
  return askType === 'CORPORATE_MEMBERSHIP' && TIER_REQUIRED_STAGES.includes(stage);
}

/** Expected value of an open deal; closed deals contribute nothing here. */
export function weightedAmount(amountMinor: number | null, stage: DealStage): number {
  if (amountMinor === null || isClosedStage(stage)) return 0;
  return Math.round(amountMinor * STAGE_PROBABILITY[stage]);
}

export interface StageChangeInput {
  askType: AskType;
  tierId: string | null;
  amountMinor: number | null;
  from: DealStage;
  to: DealStage;
  lostReason?: string | null;
}

/**
 * Field errors for a stage move, or `null` when it is allowed. Every message
 * here is one the user can act on in the same dialog.
 */
export function stageChangeProblems(input: StageChangeInput): Record<string, string[]> | null {
  const problems: Record<string, string[]> = {};
  if (input.from === input.to) {
    problems.stage = ['The deal is already in that stage.'];
  }
  if (needsTier(input.askType, input.to) && (input.tierId === null || input.amountMinor === null)) {
    problems.tierId = ['Choose a membership tier first.'];
  }
  if (input.to === 'LOST' && !input.lostReason?.trim()) {
    problems.lostReason = ['Say why the deal was lost.'];
  }
  return Object.keys(problems).length > 0 ? problems : null;
}

// ─── Follow-ups ─────────────────────────────────────────────────────────────

export interface FollowUpFacts {
  stage: DealStage;
  nextActionDue: Date | null;
}

/** The next action's due day has passed and the deal is still open. */
export function isOverdue(deal: FollowUpFacts, now: Date): boolean {
  if (!deal.nextActionDue || isClosedStage(deal.stage)) return false;
  return deal.nextActionDue.getTime() < startOfUtcDay(now).getTime();
}

/** Due within `days` days from today - overdue ones included. */
export function isDueWithin(deal: FollowUpFacts, now: Date, days: number): boolean {
  if (!deal.nextActionDue || isClosedStage(deal.stage)) return false;
  return deal.nextActionDue.getTime() <= addDays(startOfUtcDay(now), days).getTime();
}

/**
 * Open, and nobody has touched the partner for `staleDays` - no note, call,
 * email, meeting or stage change. `lastTouchedAt` is the latest of those.
 */
export function isStale(
  deal: { stage: DealStage; lastTouchedAt: Date },
  now: Date,
  staleDays: number = DEFAULT_STALE_DAYS,
): boolean {
  if (isClosedStage(deal.stage)) return false;
  return now.getTime() - deal.lastTouchedAt.getTime() > staleDays * 24 * 3_600_000;
}

// ─── Memberships ────────────────────────────────────────────────────────────

export function membershipEndDate(startDate: Date): Date {
  return addMonths(startDate, MEMBERSHIP_TERM_MONTHS);
}

/**
 * The status to show. `EXPIRED` is derived when read - once `endDate` has
 * passed - so nothing has to run on a schedule to flip it.
 */
export function effectiveMembershipStatus(
  membership: { status: MembershipStatus; endDate: Date },
  now: Date,
): MembershipStatus {
  if (membership.status === 'CANCELLED') return 'CANCELLED';
  if (membership.status === 'EXPIRED') return 'EXPIRED';
  return membership.endDate.getTime() < startOfUtcDay(now).getTime() ? 'EXPIRED' : 'ACTIVE';
}

/** Active, and ending within the notice window. */
export function isRenewalDue(
  membership: { status: MembershipStatus; endDate: Date },
  now: Date,
  noticeDays: number = DEFAULT_RENEWAL_NOTICE_DAYS,
): boolean {
  if (effectiveMembershipStatus(membership, now) !== 'ACTIVE') return false;
  return membership.endDate.getTime() <= addDays(startOfUtcDay(now), noticeDays).getTime();
}
