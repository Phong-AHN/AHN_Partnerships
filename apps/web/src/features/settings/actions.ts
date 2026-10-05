'use server';

import { z } from 'zod';
import { transaction } from '@partners/db';
import { actionOk, defineAction } from '@/server/action';
import { optionalMoney } from '@/server/fields';
import { audit } from '@/server/record';

const days = (label: string, max: number) =>
  z.coerce
    .number({ invalid_type_error: `${label} must be a number of days.` })
    .int(`${label} must be a whole number of days.`)
    .min(1, `${label} must be at least 1 day.`)
    .max(max, `${label} can be at most ${max} days.`);

export const updateSettingsAction = defineAction({
  name: 'settings.update',
  permission: 'settings:manage',
  input: z.object({
    annualTarget: optionalMoney,
    renewalNoticeDays: days('Renewal notice', 365),
    staleDays: days('Quiet threshold', 365),
  }),
  handler: async (input, ctx) => {
    await transaction(async (tx) => {
      const values = {
        annualTargetMinor: input.annualTarget,
        renewalNoticeDays: input.renewalNoticeDays,
        staleDays: input.staleDays,
      };
      for (const [key, value] of Object.entries(values)) {
        if (value === null) {
          await tx.appSetting.deleteMany({ where: { key } });
        } else {
          await tx.appSetting.upsert({ where: { key }, create: { key, value }, update: { value } });
        }
      }
      await audit(tx, {
        principal: ctx.principal,
        action: 'settings.update',
        entityType: 'AppSetting',
        after: values,
        ip: ctx.ip,
      });
    });
    return actionOk(undefined, 'Settings saved.');
  },
});
