'use server';

import { z } from 'zod';
import { NotFoundError, ValidationError } from '@partners/core';
import { isUniqueViolation, transaction, type DbTransaction } from '@partners/db';
import { actionOk, defineAction } from '@/server/action';
import { checkbox, id, optionalText, requiredText, year } from '@/server/fields';
import { audit } from '@/server/record';

const tierFields = {
  name: requiredText('Name', 60),
  year,
  price: z
    .string({ required_error: 'Enter a price.' })
    .trim()
    .transform((value, ctx) => {
      const cleaned = value.replace(/^\$/, '').replace(/,/g, '');
      if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a price, like 25000.' });
        return z.NEVER;
      }
      return Math.round(Number(cleaned) * 100);
    }),
  benefits: optionalText(4000).transform((value) =>
    (value ?? '')
      .split('\n')
      .map((line) => line.replace(/^[-•*]\s*/, '').trim())
      .filter(Boolean),
  ),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
  isActive: checkbox,
};

/** `Title Package` + 2027 → `TITLE_PACKAGE_2027`. */
function tierCode(name: string, tierYear: number): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
  return `${slug || 'TIER'}_${tierYear}`;
}

async function assertUnique(tx: DbTransaction, name: string, tierYear: number, exceptId?: string) {
  const clash = await tx.membershipTier.findFirst({
    where: {
      OR: [
        { name: { equals: name, mode: 'insensitive' }, year: tierYear },
        { code: tierCode(name, tierYear) },
      ],
      ...(exceptId ? { NOT: { id: exceptId } } : {}),
    },
    select: { id: true },
  });
  if (clash) {
    const message = `There is already a ${name} tier for ${tierYear}.`;
    throw new ValidationError(message, { name: [message] });
  }
}

function rethrowClash(error: unknown): never {
  if (isUniqueViolation(error)) {
    throw new ValidationError('That tier already exists for that year.', {
      name: ['That tier already exists for that year.'],
    });
  }
  throw error;
}

export const createTierAction = defineAction({
  name: 'tiers.create',
  permission: 'tier:manage',
  input: z.object(tierFields),
  handler: async ({ price, ...input }, ctx) => {
    const tier = await transaction(async (tx) => {
      await assertUnique(tx, input.name, input.year);
      const row = await tx.membershipTier.create({
        data: { ...input, priceMinor: price, code: tierCode(input.name, input.year) },
      });
      await audit(tx, {
        principal: ctx.principal,
        action: 'tier.create',
        entityType: 'MembershipTier',
        entityId: row.id,
        after: { code: row.code, priceMinor: row.priceMinor },
        ip: ctx.ip,
      });
      return row;
    }).catch(rethrowClash);
    return actionOk({ id: tier.id }, `${tier.name} ${tier.year} added.`);
  },
});

/**
 * Editing a price changes what the tier costs from now on. Deals already
 * given this tier keep the price they snapshotted; memberships keep theirs.
 */
export const updateTierAction = defineAction({
  name: 'tiers.update',
  permission: 'tier:manage',
  input: z.object({ id, ...tierFields }),
  handler: async ({ id: tierId, price, ...input }, ctx) => {
    await transaction(async (tx) => {
      const before = await tx.membershipTier.findUnique({ where: { id: tierId } });
      if (!before) throw new NotFoundError('That tier no longer exists.');
      await assertUnique(tx, input.name, input.year, tierId);
      await tx.membershipTier.update({
        where: { id: tierId },
        data: { ...input, priceMinor: price, code: tierCode(input.name, input.year) },
      });
      await audit(tx, {
        principal: ctx.principal,
        action: 'tier.update',
        entityType: 'MembershipTier',
        entityId: tierId,
        before: {
          name: before.name,
          year: before.year,
          priceMinor: before.priceMinor,
          isActive: before.isActive,
        },
        after: { name: input.name, year: input.year, priceMinor: price, isActive: input.isActive },
        ip: ctx.ip,
      });
    }).catch(rethrowClash);
    return actionOk(undefined, 'Tier saved.');
  },
});
