'use server';

import { z } from 'zod';
import { createPasswordToken, hashPassword, revokeAllSessionsForUser } from '@partners/auth';
import { env } from '@partners/config';
import { NotFoundError, USER_ROLES, ValidationError, type UserRole } from '@partners/core';
import { randomToken } from '@partners/core/server';
import { transaction, type DbTransaction } from '@partners/db';
import { actionOk, defineAction } from '@/server/action';
import { checkbox, id, requiredText } from '@/server/fields';
import { audit } from '@/server/record';

/**
 * There is no email sending in v1 (PLAN.md §1). Inviting someone, or
 * resetting their password, returns a one-time set-password link that the
 * admin copies and sends themselves. The raw token exists only in that
 * response; the database keeps its hash.
 */

function setPasswordUrl(token: string): string {
  return `${env().APP_URL}/set-password?token=${encodeURIComponent(token)}`;
}

/** The workspace must always keep one active admin who is not the change's target. */
async function assertAnotherAdminRemains(tx: DbTransaction, userId: string) {
  const others = await tx.user.count({
    where: { role: 'ADMIN', isActive: true, NOT: { id: userId } },
  });
  if (others === 0) {
    throw new ValidationError('Keep at least one active admin.', {
      role: ['Keep at least one active admin.'],
    });
  }
}

export const inviteUserAction = defineAction({
  name: 'users.invite',
  permission: 'user:manage',
  input: z.object({
    name: requiredText('Name', 120),
    email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
    role: z.enum(USER_ROLES, { errorMap: () => ({ message: 'Choose a role.' }) }),
  }),
  handler: async (input, ctx) => {
    const user = await transaction(async (tx) => {
      const existing = await tx.user.findUnique({
        where: { email: input.email },
        select: { id: true },
      });
      if (existing) {
        throw new ValidationError('That email already has an account.', {
          email: ['That email already has an account. Use "Reset link" on it instead.'],
        });
      }
      // A real but unusable hash: nobody knows the password until the link is used.
      const row = await tx.user.create({
        data: { ...input, passwordHash: await hashPassword(randomToken(32)) },
      });
      await audit(tx, {
        principal: ctx.principal,
        action: 'user.invite',
        entityType: 'User',
        entityId: row.id,
        after: { email: row.email, role: row.role },
        ip: ctx.ip,
      });
      return row;
    });
    const { token, expiresAt } = await createPasswordToken(user.id, 'INVITE');
    return actionOk(
      { link: setPasswordUrl(token), expiresAt: expiresAt.toISOString(), name: user.name },
      `${user.name} invited.`,
    );
  },
});

export const resetLinkAction = defineAction({
  name: 'users.reset_link',
  permission: 'user:manage',
  input: z.object({ id }),
  handler: async ({ id: userId }, ctx) => {
    const user = await transaction(async (tx) => {
      const row = await tx.user.findUnique({ where: { id: userId } });
      if (!row) throw new NotFoundError('That user no longer exists.');
      if (!row.isActive) {
        throw new ValidationError('Reactivate the account first.', {
          id: ['Reactivate the account first.'],
        });
      }
      await audit(tx, {
        principal: ctx.principal,
        action: 'user.reset_link',
        entityType: 'User',
        entityId: userId,
        ip: ctx.ip,
      });
      return row;
    });
    const { token, expiresAt } = await createPasswordToken(user.id, 'RESET');
    return actionOk(
      { link: setPasswordUrl(token), expiresAt: expiresAt.toISOString(), name: user.name },
      'Reset link created.',
    );
  },
});

export const updateUserAction = defineAction({
  name: 'users.update',
  permission: 'user:manage',
  input: z.object({
    id,
    name: requiredText('Name', 120),
    role: z.enum(USER_ROLES, { errorMap: () => ({ message: 'Choose a role.' }) }),
    isActive: checkbox,
  }),
  handler: async ({ id: userId, name, role, isActive }, ctx) => {
    await transaction(async (tx) => {
      const before = await tx.user.findUnique({ where: { id: userId } });
      if (!before) throw new NotFoundError('That user no longer exists.');
      if (userId === ctx.principal.id && (!isActive || role !== before.role)) {
        throw new ValidationError('You cannot change your own role or deactivate yourself.', {
          role: ['Ask another admin to do that.'],
        });
      }
      const losesAdmin =
        before.role === 'ADMIN' && before.isActive && (role !== 'ADMIN' || !isActive);
      if (losesAdmin) await assertAnotherAdminRemains(tx, userId);

      await tx.user.update({
        where: { id: userId },
        data: { name, role: role as UserRole, isActive },
      });
      await audit(tx, {
        principal: ctx.principal,
        action: 'user.update',
        entityType: 'User',
        entityId: userId,
        before: { name: before.name, role: before.role, isActive: before.isActive },
        after: { name, role, isActive },
        ip: ctx.ip,
      });
    });
    // Sessions read the role fresh on every request, so a role change applies
    // immediately; a deactivation also ends every session outright.
    if (!isActive) await revokeAllSessionsForUser(userId);
    return actionOk(undefined, isActive ? 'User saved.' : 'User deactivated.');
  },
});
