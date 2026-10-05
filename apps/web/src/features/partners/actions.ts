'use server';

import { z } from 'zod';
import { clock, NotFoundError, PRIORITIES, SECTORS, ValidationError } from '@partners/core';
import { isUniqueViolation, transaction, type DbTransaction } from '@partners/db';
import { actionOk, defineAction } from '@/server/action';
import {
  checkbox,
  id,
  optionalEmail,
  optionalId,
  optionalText,
  optionalUrl,
  requiredText,
} from '@/server/fields';
import { audit } from '@/server/record';

// ─── Partners ───────────────────────────────────────────────────────────────

const partnerFields = {
  name: requiredText('Name', 160),
  sector: z.enum(SECTORS, { errorMap: () => ({ message: 'Choose a sector.' }) }),
  priority: z.enum(PRIORITIES, { errorMap: () => ({ message: 'Choose a priority.' }) }),
  website: optionalUrl,
  summary: optionalText(2000),
  ownerId: optionalId,
  existingRelationship: checkbox,
};

const NAME_TAKEN = 'A partner with that name already exists.';

/** Names are unique ignoring case: "Meta" and "meta" are the same company. */
async function assertNameFree(tx: DbTransaction, name: string, exceptId?: string) {
  const clash = await tx.partner.findFirst({
    where: {
      name: { equals: name, mode: 'insensitive' },
      ...(exceptId ? { NOT: { id: exceptId } } : {}),
    },
    select: { id: true },
  });
  if (clash) throw new ValidationError(NAME_TAKEN, { name: [NAME_TAKEN] });
}

async function assertActiveUser(tx: DbTransaction, userId: string | null, field: string) {
  if (!userId) return;
  const user = await tx.user.findFirst({
    where: { id: userId, isActive: true },
    select: { id: true },
  });
  if (!user)
    throw new ValidationError('Choose an active team member.', {
      [field]: ['Choose an active team member.'],
    });
}

/** Unique-index races still land as a field error, never a raw P2002. */
function rethrowNameClash(error: unknown): never {
  if (isUniqueViolation(error, 'name'))
    throw new ValidationError(NAME_TAKEN, { name: [NAME_TAKEN] });
  throw error;
}

export const createPartnerAction = defineAction({
  name: 'partners.create',
  permission: 'partner:write',
  input: z.object(partnerFields),
  handler: async (input, ctx) => {
    const partner = await transaction(async (tx) => {
      await assertNameFree(tx, input.name);
      await assertActiveUser(tx, input.ownerId, 'ownerId');
      const row = await tx.partner.create({ data: input });
      await audit(tx, {
        principal: ctx.principal,
        action: 'partner.create',
        entityType: 'Partner',
        entityId: row.id,
        after: { name: row.name, sector: row.sector, priority: row.priority },
        ip: ctx.ip,
      });
      return row;
    }).catch(rethrowNameClash);
    return actionOk({ id: partner.id }, `${partner.name} added.`);
  },
});

export const updatePartnerAction = defineAction({
  name: 'partners.update',
  permission: 'partner:write',
  input: z.object({ id, ...partnerFields }),
  handler: async ({ id: partnerId, ...input }, ctx) => {
    await transaction(async (tx) => {
      const before = await tx.partner.findUnique({ where: { id: partnerId } });
      if (!before) throw new NotFoundError('That partner no longer exists.');
      await assertNameFree(tx, input.name, partnerId);
      await assertActiveUser(tx, input.ownerId, 'ownerId');
      await tx.partner.update({ where: { id: partnerId }, data: input });
      await audit(tx, {
        principal: ctx.principal,
        action: 'partner.update',
        entityType: 'Partner',
        entityId: partnerId,
        before: {
          name: before.name,
          sector: before.sector,
          priority: before.priority,
          ownerId: before.ownerId,
        },
        after: {
          name: input.name,
          sector: input.sector,
          priority: input.priority,
          ownerId: input.ownerId,
        },
        ip: ctx.ip,
      });
    }).catch(rethrowNameClash);
    return actionOk(undefined, 'Partner updated.');
  },
});

export const archivePartnerAction = defineAction({
  name: 'partners.archive',
  permission: 'partner:archive',
  input: z.object({ id, archived: checkbox }),
  handler: async ({ id: partnerId, archived }, ctx) => {
    await transaction(async (tx) => {
      const partner = await tx.partner.findUnique({
        where: { id: partnerId },
        select: { id: true },
      });
      if (!partner) throw new NotFoundError('That partner no longer exists.');
      await tx.partner.update({
        where: { id: partnerId },
        data: { archivedAt: archived ? clock.now() : null },
      });
      await audit(tx, {
        principal: ctx.principal,
        action: archived ? 'partner.archive' : 'partner.restore',
        entityType: 'Partner',
        entityId: partnerId,
        ip: ctx.ip,
      });
    });
    return actionOk(undefined, archived ? 'Partner archived.' : 'Partner restored.');
  },
});

// ─── Contacts ───────────────────────────────────────────────────────────────

export const upsertContactAction = defineAction({
  name: 'contacts.upsert',
  permission: 'contact:write',
  input: z.object({
    id: optionalId,
    partnerId: id,
    name: requiredText('Name', 160),
    title: optionalText(160),
    email: optionalEmail,
    phone: optionalText(60),
    linkedin: optionalUrl,
    isPrimary: checkbox,
    notes: optionalText(2000),
  }),
  handler: async ({ id: contactId, partnerId, ...data }, ctx) => {
    const saved = await transaction(async (tx) => {
      const partner = await tx.partner.findUnique({
        where: { id: partnerId },
        select: { id: true },
      });
      if (!partner) throw new NotFoundError('That partner no longer exists.');

      if (contactId) {
        const existing = await tx.partnerContact.findFirst({
          where: { id: contactId, partnerId },
          select: { id: true },
        });
        if (!existing) throw new NotFoundError('That contact no longer exists.');
      }
      // One primary contact per partner: choosing a new one demotes the old.
      if (data.isPrimary) {
        await tx.partnerContact.updateMany({
          where: { partnerId, isPrimary: true, ...(contactId ? { NOT: { id: contactId } } : {}) },
          data: { isPrimary: false },
        });
      }
      const row = contactId
        ? await tx.partnerContact.update({ where: { id: contactId }, data })
        : await tx.partnerContact.create({ data: { ...data, partnerId } });
      await audit(tx, {
        principal: ctx.principal,
        action: contactId ? 'contact.update' : 'contact.create',
        entityType: 'PartnerContact',
        entityId: row.id,
        after: { partnerId, name: row.name, email: row.email },
        ip: ctx.ip,
      });
      return row;
    });
    return actionOk({ id: saved.id }, contactId ? 'Contact updated.' : `${saved.name} added.`);
  },
});

export const deleteContactAction = defineAction({
  name: 'contacts.delete',
  permission: 'contact:write',
  input: z.object({ id }),
  handler: async ({ id: contactId }, ctx) => {
    await transaction(async (tx) => {
      const contact = await tx.partnerContact.findUnique({ where: { id: contactId } });
      if (!contact) throw new NotFoundError('That contact no longer exists.');
      await tx.partnerContact.delete({ where: { id: contactId } });
      await audit(tx, {
        principal: ctx.principal,
        action: 'contact.delete',
        entityType: 'PartnerContact',
        entityId: contactId,
        before: { partnerId: contact.partnerId, name: contact.name, email: contact.email },
        ip: ctx.ip,
      });
    });
    return actionOk(undefined, 'Contact removed.');
  },
});
