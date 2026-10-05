'use server';

import { z } from 'zod';
import { createLoginToken, revokeAllSessionsForUser } from '@partners/auth';
import { NotFoundError, USER_ROLES, ValidationError, type UserRole } from '@partners/core';
import { transaction, type DbTransaction } from '@partners/db';
import { logger } from '@partners/observability';
import { actionOk, defineAction } from '@/server/action';
import { sendInviteEmail, sendSignInEmail } from '@/server/email';
import { checkbox, id, requiredText } from '@/server/fields';
import { audit } from '@/server/record';

/**
 * Nobody has a password. Adding someone emails them an invitation link
 * (through Resend); after that they ask for a sign-in link themselves on the
 * sign-in page. An admin never handles a link by hand - "Send sign-in link"
 * here just emails one on the person's behalf.
 */

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
          email: ['That email already has an account. Use "Send sign-in link" on it instead.'],
        });
      }
      const row = await tx.user.create({ data: input });
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

    const { token, expiresAt } = await createLoginToken(user.id, 'INVITE');
    try {
      await sendInviteEmail({
        to: user.email,
        name: user.name,
        inviterName: ctx.principal.name,
        token,
        expiresAt,
      });
    } catch (error) {
      // The account exists either way; say so, and how to retry.
      logger.error({ err: error, userId: user.id }, 'invite email failed to send');
      return actionOk(
        { emailed: false },
        `${user.name} was added, but the invitation email could not be sent. Try "Send sign-in link" in a moment.`,
      );
    }
    return actionOk({ emailed: true }, `Invitation emailed to ${user.email}.`);
  },
});

/**
 * Emails a link on the person's behalf: an invitation again if they have
 * never signed in, an ordinary sign-in link otherwise.
 */
export const sendSignInLinkAction = defineAction({
  name: 'users.send_sign_in_link',
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
        action: 'user.send_sign_in_link',
        entityType: 'User',
        entityId: userId,
        ip: ctx.ip,
      });
      return row;
    });

    const neverSignedIn = user.lastLoginAt === null;
    const { token, expiresAt } = await createLoginToken(
      user.id,
      neverSignedIn ? 'INVITE' : 'SIGN_IN',
    );
    if (neverSignedIn) {
      await sendInviteEmail({
        to: user.email,
        name: user.name,
        inviterName: ctx.principal.name,
        token,
        expiresAt,
      });
    } else {
      await sendSignInEmail({ to: user.email, name: user.name, token, expiresAt });
    }
    return actionOk(
      undefined,
      `${neverSignedIn ? 'Invitation' : 'Sign-in link'} emailed to ${user.email}.`,
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
