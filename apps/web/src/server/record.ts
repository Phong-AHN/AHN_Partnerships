import { clock, type ActivityType } from '@partners/core';
import type { DbTransaction, Prisma } from '@partners/db';
import type { Principal } from '@partners/rbac';

/**
 * Two writes that must happen inside the same transaction as the change they
 * describe, so the log and the timeline cannot drift from reality:
 *
 *   - `audit`        - who did what, for the trail
 *   - `logActivity`  - the human-readable partner timeline
 */

export async function audit(
  tx: DbTransaction,
  input: {
    principal: Principal | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    before?: Prisma.InputJsonValue | null;
    after?: Prisma.InputJsonValue | null;
    reason?: string | null;
    ip?: string | null;
  },
): Promise<void> {
  await tx.auditLog.create({
    data: {
      actorId: input.principal?.id ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      before: input.before ?? undefined,
      after: input.after ?? undefined,
      reason: input.reason ?? null,
      ip: input.ip ?? null,
      occurredAt: clock.now(),
    },
  });
}

export async function logActivity(
  tx: DbTransaction,
  input: {
    partnerId: string;
    dealId?: string | null;
    type: ActivityType;
    body: string;
    authorId?: string | null;
    occurredAt?: Date;
  },
): Promise<string> {
  const row = await tx.activity.create({
    data: {
      partnerId: input.partnerId,
      dealId: input.dealId ?? null,
      type: input.type,
      body: input.body,
      authorId: input.authorId ?? null,
      occurredAt: input.occurredAt ?? clock.now(),
    },
    select: { id: true },
  });
  return row.id;
}
