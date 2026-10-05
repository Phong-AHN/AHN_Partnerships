'use server';

import { z } from 'zod';
import {
  addDays,
  clock,
  ConflictError,
  defaultDealTitle,
  formatDate,
  NotFoundError,
  startOfUtcDay,
  ValidationError,
} from '@partners/core';
import { transaction, type DbTransaction } from '@partners/db';
import { actionOk, defineAction } from '@/server/action';
import { checkbox, id, optionalDate, optionalText } from '@/server/fields';
import { audit, logActivity } from '@/server/record';

async function loadMembership(tx: DbTransaction, membershipId: string) {
  const membership = await tx.membership.findUnique({
    where: { id: membershipId },
    include: {
      tier: { select: { id: true, name: true, year: true, priceMinor: true } },
      deal: { select: { id: true, year: true, entity: true, ownerId: true } },
      partner: { select: { id: true, name: true } },
    },
  });
  if (!membership) throw new NotFoundError('That membership no longer exists.');
  return membership;
}

export const markPaidAction = defineAction({
  name: 'memberships.mark_paid',
  permission: 'membership:write',
  input: z.object({ id, paid: checkbox, paidOn: optionalDate }),
  handler: async ({ id: membershipId, paid, paidOn }, ctx) => {
    const now = clock.now();
    if (paidOn && paidOn.getTime() > startOfUtcDay(now).getTime()) {
      throw new ValidationError('That date is in the future.', {
        paidOn: ['That date is in the future.'],
      });
    }
    await transaction(async (tx) => {
      const membership = await loadMembership(tx, membershipId);
      const paidAt = paid ? (paidOn ?? now) : null;
      await tx.membership.update({ where: { id: membershipId }, data: { paidAt } });
      await audit(tx, {
        principal: ctx.principal,
        action: paid ? 'membership.mark_paid' : 'membership.mark_unpaid',
        entityType: 'Membership',
        entityId: membershipId,
        before: { paidAt: membership.paidAt?.toISOString() ?? null },
        after: { paidAt: paidAt?.toISOString() ?? null },
        ip: ctx.ip,
      });
    });
    return actionOk(undefined, paid ? 'Marked as paid.' : 'Marked as unpaid.');
  },
});

export const cancelMembershipAction = defineAction({
  name: 'memberships.cancel',
  permission: 'membership:write',
  input: z.object({ id, reason: optionalText(1000) }),
  handler: async ({ id: membershipId, reason }, ctx) => {
    await transaction(async (tx) => {
      const membership = await loadMembership(tx, membershipId);
      if (membership.status === 'CANCELLED')
        throw new ConflictError('That membership is already cancelled.');
      const now = clock.now();
      await tx.membership.update({
        where: { id: membershipId },
        data: {
          status: 'CANCELLED',
          cancelledAt: now,
          notes: reason
            ? [membership.notes, `Cancelled ${formatDate(now)}: ${reason}`]
                .filter(Boolean)
                .join('\n')
            : membership.notes,
        },
      });
      await logActivity(tx, {
        partnerId: membership.partnerId,
        dealId: membership.dealId,
        type: 'NOTE',
        authorId: ctx.principal.id,
        body: `${membership.tier.name} membership cancelled${reason ? `: ${reason}` : '.'}`,
      });
      await audit(tx, {
        principal: ctx.principal,
        action: 'membership.cancel',
        entityType: 'Membership',
        entityId: membershipId,
        reason,
        ip: ctx.ip,
      });
    });
    return actionOk(undefined, 'Membership cancelled.');
  },
});

/**
 * "Renew" opens next year's membership deal at IN_DISCUSSION. The tier carries
 * over - next year's tier of the same name when one exists, so a 2028 price
 * list is picked up automatically - and its price is snapshotted as usual.
 */
export const renewMembershipAction = defineAction({
  name: 'memberships.renew',
  permission: 'deal:write',
  input: z.object({ id }),
  handler: async ({ id: membershipId }, ctx) => {
    const deal = await transaction(async (tx) => {
      const membership = await loadMembership(tx, membershipId);
      if (membership.status === 'CANCELLED') {
        throw new ConflictError(
          'A cancelled membership cannot be renewed - open a new deal instead.',
        );
      }
      const year = (membership.deal?.year ?? membership.endDate.getUTCFullYear()) + 1;

      const existing = await tx.deal.findFirst({
        where: {
          partnerId: membership.partnerId,
          year,
          askType: 'CORPORATE_MEMBERSHIP',
          stage: { not: 'LOST' },
        },
        select: { id: true },
      });
      if (existing)
        throw new ConflictError(
          `${membership.partner.name} already has a ${year} membership deal.`,
        );

      const nextTier =
        (await tx.membershipTier.findFirst({
          where: { name: membership.tier.name, year, isActive: true },
          select: { id: true, priceMinor: true },
        })) ?? membership.tier;

      const now = clock.now();
      const row = await tx.deal.create({
        data: {
          partnerId: membership.partnerId,
          title: `${defaultDealTitle(year, 'CORPORATE_MEMBERSHIP')} (renewal)`,
          year,
          entity: membership.deal?.entity ?? 'AHN',
          askType: 'CORPORATE_MEMBERSHIP',
          tierId: nextTier.id,
          amountMinor: nextTier.priceMinor,
          stage: 'IN_DISCUSSION',
          ownerId: membership.deal?.ownerId ?? null,
          nextAction: 'Renewal conversation',
          nextActionDue: addDays(startOfUtcDay(now), 7),
          expectedCloseDate: membership.endDate,
        },
      });
      await logActivity(tx, {
        partnerId: membership.partnerId,
        dealId: row.id,
        type: 'DEAL_CREATED',
        authorId: ctx.principal.id,
        body: `Renewal opened for the ${membership.tier.name} membership ending ${formatDate(membership.endDate)}.`,
      });
      await audit(tx, {
        principal: ctx.principal,
        action: 'membership.renew',
        entityType: 'Membership',
        entityId: membershipId,
        after: { dealId: row.id, year, tierId: nextTier.id },
        ip: ctx.ip,
      });
      return row;
    });
    return actionOk({ dealId: deal.id, partnerId: deal.partnerId }, `${deal.title} opened.`);
  },
});
