'use server';

import { z } from 'zod';
import {
  ACTIVITY_TYPE_LABEL,
  clock,
  LOGGABLE_ACTIVITY_TYPES,
  NotFoundError,
  startOfUtcDay,
  ValidationError,
} from '@partners/core';
import { transaction } from '@partners/db';
import { actionOk, defineAction } from '@/server/action';
import { id, optionalDate, optionalId, requiredText } from '@/server/fields';
import { logActivity } from '@/server/record';

/**
 * The quick note box on a partner page: a note, an email, a call or a
 * meeting, optionally about one of the partner's deals. Backdating is allowed
 * (a call yesterday logged today); a date in the future is not.
 */
export const logActivityAction = defineAction({
  name: 'activity.log',
  permission: 'activity:write',
  input: z.object({
    partnerId: id,
    dealId: optionalId,
    type: z.enum(LOGGABLE_ACTIVITY_TYPES, {
      errorMap: () => ({ message: 'Choose note, email, call or meeting.' }),
    }),
    body: requiredText('What happened', 5000),
    occurredOn: optionalDate,
  }),
  handler: async (input, ctx) => {
    const now = clock.now();
    if (input.occurredOn && input.occurredOn.getTime() > startOfUtcDay(now).getTime()) {
      throw new ValidationError('That date is in the future.', {
        occurredOn: ['That date is in the future.'],
      });
    }

    await transaction(async (tx) => {
      const partner = await tx.partner.findUnique({
        where: { id: input.partnerId },
        select: { id: true },
      });
      if (!partner) throw new NotFoundError('That partner no longer exists.');
      if (input.dealId) {
        const deal = await tx.deal.findFirst({
          where: { id: input.dealId, partnerId: input.partnerId },
          select: { id: true },
        });
        if (!deal) {
          throw new ValidationError('That deal is not one of this partner’s.', {
            dealId: ['That deal is not one of this partner’s.'],
          });
        }
      }
      // A backdated entry keeps today's time of day, so two entries logged
      // for the same day still read in the order they were written.
      const occurredAt = input.occurredOn
        ? new Date(input.occurredOn.getTime() + (now.getTime() - startOfUtcDay(now).getTime()))
        : now;
      await logActivity(tx, {
        partnerId: input.partnerId,
        dealId: input.dealId,
        type: input.type,
        body: input.body,
        authorId: ctx.principal.id,
        occurredAt,
      });
    });
    return actionOk(undefined, `${ACTIVITY_TYPE_LABEL[input.type].label} logged.`);
  },
});
