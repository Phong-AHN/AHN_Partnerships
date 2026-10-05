import 'server-only';
import {
  clock,
  ConflictError,
  DEAL_STAGE_LABEL,
  formatDate,
  formatMoney,
  isClosedStage,
  membershipEndDate,
  needsTier,
  NotFoundError,
  stageChangeProblems,
  startOfUtcDay,
  ValidationError,
  type DealStage,
} from '@partners/core';
import type { DbTransaction } from '@partners/db';
import type { Principal } from '@partners/rbac';
import { audit, logActivity } from '@/server/record';

/**
 * The deal rules from PLAN.md §4, in one place. Every action that changes a
 * deal's tier or stage goes through these, inside the caller's transaction, so
 * the membership, the timeline and the audit trail move together or not at all.
 */

export async function loadDeal(tx: DbTransaction, dealId: string) {
  const deal = await tx.deal.findUnique({
    where: { id: dealId },
    include: {
      partner: { select: { id: true, name: true } },
      tier: { select: { id: true, name: true, priceMinor: true } },
      membership: { select: { id: true, status: true } },
    },
  });
  if (!deal) throw new NotFoundError('That deal no longer exists.');
  return deal;
}

type LoadedDeal = Awaited<ReturnType<typeof loadDeal>>;

/**
 * Assigning a tier snapshots its price into the deal. Changing the tier later
 * re-snapshots; changing the tier's price later does not touch the deal.
 */
export async function assignTier(
  tx: DbTransaction,
  deal: LoadedDeal,
  tierId: string | null,
  principal: Principal,
  ip: string | null,
): Promise<LoadedDeal> {
  if (deal.askType !== 'CORPORATE_MEMBERSHIP') {
    throw new ValidationError('Only a corporate membership deal has a tier.', {
      tierId: ['Only a corporate membership deal has a tier.'],
    });
  }
  if (deal.membership) {
    throw new ValidationError('This deal already created a membership; its tier is fixed.', {
      tierId: ['This deal already created a membership; its tier is fixed.'],
    });
  }
  if (tierId === null && needsTier(deal.askType, deal.stage)) {
    throw new ValidationError('A deal at this stage needs a tier.', {
      tierId: ['A deal at this stage needs a tier.'],
    });
  }
  const tier = tierId
    ? await tx.membershipTier.findUnique({
        where: { id: tierId },
        select: { id: true, name: true, year: true, priceMinor: true },
      })
    : null;
  if (tierId && !tier) {
    throw new ValidationError('That tier no longer exists.', {
      tierId: ['That tier no longer exists.'],
    });
  }

  await tx.deal.update({
    where: { id: deal.id },
    data: { tierId: tier?.id ?? null, amountMinor: tier?.priceMinor ?? null },
  });
  await audit(tx, {
    principal,
    action: 'deal.assign_tier',
    entityType: 'Deal',
    entityId: deal.id,
    before: { tierId: deal.tierId, amountMinor: deal.amountMinor },
    after: { tierId: tier?.id ?? null, amountMinor: tier?.priceMinor ?? null },
    ip,
  });
  return loadDeal(tx, deal.id);
}

export interface StageMove {
  to: DealStage;
  lostReason?: string | null;
  /** WON on a membership deal: the first day of the membership. Defaults to today. */
  startDate?: Date | null;
}

export async function moveStage(
  tx: DbTransaction,
  deal: LoadedDeal,
  move: StageMove,
  principal: Principal,
  ip: string | null,
): Promise<{ membershipId: string | null }> {
  const now = clock.now();
  const from = deal.stage;
  const { to } = move;

  const problems = stageChangeProblems({
    askType: deal.askType,
    tierId: deal.tierId,
    amountMinor: deal.amountMinor,
    from,
    to,
    lostReason: move.lostReason,
  });
  if (problems) throw new ValidationError(Object.values(problems)[0]![0]!, problems);

  // Leaving WON: a membership this deal created must be cancelled first, so a
  // reopened deal never leaves a live membership behind it.
  if (from === 'WON' && deal.membership) {
    if (deal.membership.status !== 'CANCELLED') {
      throw new ConflictError('Cancel the membership this deal created before reopening it.');
    }
    // Keep the cancelled membership as history, but free the deal to win again.
    await tx.membership.update({ where: { id: deal.membership.id }, data: { dealId: null } });
  }

  const closing = isClosedStage(to);
  await tx.deal.update({
    where: { id: deal.id },
    data: {
      stage: to,
      stageChangedAt: now,
      closedAt: closing ? now : null,
      lostReason: to === 'LOST' ? move.lostReason!.trim() : null,
    },
  });

  let membershipId: string | null = null;
  if (to === 'WON' && deal.askType === 'CORPORATE_MEMBERSHIP') {
    const startDate = move.startDate ?? startOfUtcDay(now);
    const endDate = membershipEndDate(startDate);
    const membership = await tx.membership.create({
      data: {
        partnerId: deal.partnerId,
        tierId: deal.tierId!,
        dealId: deal.id,
        startDate,
        endDate,
        amountMinor: deal.amountMinor!,
      },
    });
    membershipId = membership.id;
    await logActivity(tx, {
      partnerId: deal.partnerId,
      dealId: deal.id,
      type: 'MEMBERSHIP_STARTED',
      authorId: principal.id,
      occurredAt: now,
      body: `${deal.tier?.name ?? 'Membership'} membership, ${formatMoney(deal.amountMinor!, 'USD').replace(/\.00$/, '')}, ${formatDate(startDate)} to ${formatDate(endDate)}.`,
    });
  }

  await logActivity(tx, {
    partnerId: deal.partnerId,
    dealId: deal.id,
    type: 'STAGE_CHANGE',
    authorId: principal.id,
    occurredAt: now,
    body:
      `${DEAL_STAGE_LABEL[from].label} → ${DEAL_STAGE_LABEL[to].label}` +
      (to === 'LOST' ? `. Reason: ${move.lostReason!.trim()}` : ''),
  });
  await audit(tx, {
    principal,
    action: 'deal.move_stage',
    entityType: 'Deal',
    entityId: deal.id,
    before: { stage: from },
    after: { stage: to, membershipId },
    reason: to === 'LOST' ? move.lostReason!.trim() : null,
    ip,
  });

  return { membershipId };
}
