'use server';

import { z } from 'zod';
import {
  ASK_TYPES,
  DEAL_STAGES,
  DEFAULT_YEAR,
  defaultDealTitle,
  ENTITIES,
  isClosedStage,
  needsTier,
  NotFoundError,
  ValidationError,
} from '@partners/core';
import { transaction, type DbTransaction } from '@partners/db';
import { actionOk, defineAction } from '@/server/action';
import {
  id,
  optionalDate,
  optionalId,
  optionalMoney,
  optionalText,
  optionalUrl,
  year,
} from '@/server/fields';
import { audit, logActivity } from '@/server/record';
import { assignTier, loadDeal, moveStage } from './mutations';

const TIER_FIRST = 'Choose a membership tier first.';

async function findTier(tx: DbTransaction, tierId: string) {
  const tier = await tx.membershipTier.findUnique({
    where: { id: tierId },
    select: { id: true, priceMinor: true },
  });
  if (!tier)
    throw new ValidationError('That tier no longer exists.', {
      tierId: ['That tier no longer exists.'],
    });
  return tier;
}

async function assertActiveOwner(tx: DbTransaction, ownerId: string | null) {
  if (!ownerId) return;
  const owner = await tx.user.findFirst({
    where: { id: ownerId, isActive: true },
    select: { id: true },
  });
  if (!owner) {
    throw new ValidationError('Choose an active team member.', {
      ownerId: ['Choose an active team member.'],
    });
  }
}

const dealFields = {
  title: optionalText(200),
  year: year.default(DEFAULT_YEAR),
  entity: z.enum(ENTITIES).default('AHN'),
  askType: z.enum(ASK_TYPES, { errorMap: () => ({ message: 'Choose what we are asking for.' }) }),
  tierId: optionalId,
  amount: optionalMoney,
  expectedCloseDate: optionalDate,
  nextAction: optionalText(500),
  nextActionDue: optionalDate,
  ownerId: optionalId,
  proposalUrl: optionalUrl,
};

export const createDealAction = defineAction({
  name: 'deals.create',
  permission: 'deal:write',
  input: z.object({
    partnerId: id,
    stage: z.enum(DEAL_STAGES).default('PROSPECT'),
    ...dealFields,
  }),
  handler: async (input, ctx) => {
    if (isClosedStage(input.stage)) {
      throw new ValidationError('Create the deal open, then close it from the pipeline.', {
        stage: ['Create the deal open, then close it from the pipeline.'],
      });
    }
    const isMembership = input.askType === 'CORPORATE_MEMBERSHIP';
    if (isMembership && !input.tierId && needsTier(input.askType, input.stage)) {
      throw new ValidationError(TIER_FIRST, { tierId: [TIER_FIRST] });
    }

    const deal = await transaction(async (tx) => {
      const partner = await tx.partner.findUnique({
        where: { id: input.partnerId },
        select: { id: true },
      });
      if (!partner) throw new NotFoundError('That partner no longer exists.');
      await assertActiveOwner(tx, input.ownerId);
      const tier = isMembership && input.tierId ? await findTier(tx, input.tierId) : null;

      const row = await tx.deal.create({
        data: {
          partnerId: input.partnerId,
          title: input.title ?? defaultDealTitle(input.year, input.askType),
          year: input.year,
          entity: input.entity,
          askType: input.askType,
          tierId: tier?.id ?? null,
          // A membership's value is the tier's price, never typed by hand.
          amountMinor: isMembership ? (tier?.priceMinor ?? null) : input.amount,
          stage: input.stage,
          expectedCloseDate: input.expectedCloseDate,
          nextAction: input.nextAction,
          nextActionDue: input.nextActionDue,
          ownerId: input.ownerId,
          proposalUrl: input.proposalUrl,
        },
      });
      await logActivity(tx, {
        partnerId: input.partnerId,
        dealId: row.id,
        type: 'DEAL_CREATED',
        authorId: ctx.principal.id,
        body: `${row.title} opened.`,
      });
      await audit(tx, {
        principal: ctx.principal,
        action: 'deal.create',
        entityType: 'Deal',
        entityId: row.id,
        after: {
          partnerId: row.partnerId,
          askType: row.askType,
          stage: row.stage,
          amountMinor: row.amountMinor,
        },
        ip: ctx.ip,
      });
      return row;
    });
    return actionOk({ id: deal.id }, `${deal.title} created.`);
  },
});

export const updateDealAction = defineAction({
  name: 'deals.update',
  permission: 'deal:write',
  input: z.object({ id, ...dealFields }),
  handler: async ({ id: dealId, ...input }, ctx) => {
    await transaction(async (tx) => {
      const deal = await loadDeal(tx, dealId);
      const isMembership = input.askType === 'CORPORATE_MEMBERSHIP';
      const tierId = isMembership ? input.tierId : null;

      if (deal.membership && (input.askType !== deal.askType || tierId !== deal.tierId)) {
        const message = 'This deal already created a membership; its ask and tier are fixed.';
        throw new ValidationError(message, { tierId: [message] });
      }
      if (isMembership && !tierId && needsTier(input.askType, deal.stage)) {
        throw new ValidationError(TIER_FIRST, { tierId: [TIER_FIRST] });
      }
      await assertActiveOwner(tx, input.ownerId);

      // Same tier: keep the price snapshotted when it was assigned. New tier:
      // snapshot its current price.
      const amountMinor = !isMembership
        ? input.amount
        : tierId === deal.tierId
          ? deal.amountMinor
          : tierId
            ? (await findTier(tx, tierId)).priceMinor
            : null;

      await tx.deal.update({
        where: { id: dealId },
        data: {
          title: input.title ?? defaultDealTitle(input.year, input.askType),
          year: input.year,
          entity: input.entity,
          askType: input.askType,
          tierId,
          amountMinor,
          expectedCloseDate: input.expectedCloseDate,
          nextAction: input.nextAction,
          nextActionDue: input.nextActionDue,
          ownerId: input.ownerId,
          proposalUrl: input.proposalUrl,
        },
      });
      await audit(tx, {
        principal: ctx.principal,
        action: 'deal.update',
        entityType: 'Deal',
        entityId: dealId,
        before: {
          askType: deal.askType,
          tierId: deal.tierId,
          amountMinor: deal.amountMinor,
          year: deal.year,
        },
        after: { askType: input.askType, tierId, amountMinor, year: input.year },
        ip: ctx.ip,
      });
    });
    return actionOk(undefined, 'Deal updated.');
  },
});

export const assignTierAction = defineAction({
  name: 'deals.assign_tier',
  permission: 'deal:write',
  input: z.object({ id, tierId: optionalId }),
  handler: async ({ id: dealId, tierId }, ctx) => {
    await transaction(async (tx) => {
      const deal = await loadDeal(tx, dealId);
      await assignTier(tx, deal, tierId, ctx.principal, ctx.ip);
    });
    return actionOk(undefined, tierId ? 'Tier assigned.' : 'Tier cleared.');
  },
});

export const moveStageAction = defineAction({
  name: 'deals.move_stage',
  permission: 'deal:move_stage',
  input: z.object({
    id,
    stage: z.enum(DEAL_STAGES, { errorMap: () => ({ message: 'Choose a stage.' }) }),
    lostReason: optionalText(1000),
    startDate: optionalDate,
    /** Lets the move dialog pick a tier and move in one step. */
    tierId: optionalId,
  }),
  handler: async (input, ctx) => {
    const result = await transaction(async (tx) => {
      let deal = await loadDeal(tx, input.id);
      if (input.tierId && input.tierId !== deal.tierId) {
        deal = await assignTier(tx, deal, input.tierId, ctx.principal, ctx.ip);
      }
      return moveStage(
        tx,
        deal,
        { to: input.stage, lostReason: input.lostReason, startDate: input.startDate },
        ctx.principal,
        ctx.ip,
      );
    });
    return actionOk(result, result.membershipId ? 'Won - membership created.' : 'Stage updated.');
  },
});

export const setNextActionAction = defineAction({
  name: 'deals.set_next_action',
  permission: 'deal:write',
  input: z.object({ id, nextAction: optionalText(500), nextActionDue: optionalDate }),
  handler: async ({ id: dealId, nextAction, nextActionDue }, ctx) => {
    await transaction(async (tx) => {
      const deal = await loadDeal(tx, dealId);
      await tx.deal.update({ where: { id: dealId }, data: { nextAction, nextActionDue } });
      await audit(tx, {
        principal: ctx.principal,
        action: 'deal.set_next_action',
        entityType: 'Deal',
        entityId: dealId,
        before: {
          nextAction: deal.nextAction,
          nextActionDue: deal.nextActionDue?.toISOString() ?? null,
        },
        after: { nextAction, nextActionDue: nextActionDue?.toISOString() ?? null },
        ip: ctx.ip,
      });
    });
    return actionOk(undefined, 'Next action saved.');
  },
});
