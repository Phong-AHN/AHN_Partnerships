import 'server-only';
import {
  addDays,
  daysBetween,
  effectiveMembershipStatus,
  isRenewalDue,
  startOfUtcDay,
} from '@partners/core';
import { db, type Prisma } from '@partners/db';

export const MEMBER_VIEWS = [
  'active',
  'renewals',
  'unpaid',
  'expired',
  'cancelled',
  'all',
] as const;
export type MemberView = (typeof MEMBER_VIEWS)[number];

export function parseMemberView(raw: string | string[] | undefined): MemberView {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (MEMBER_VIEWS as readonly string[]).includes(value ?? '')
    ? (value as MemberView)
    : 'active';
}

/** EXPIRED is derived on read, so "active" and "expired" are date ranges, not a column. */
function whereFor(view: MemberView, today: Date, noticeDays: number): Prisma.MembershipWhereInput {
  switch (view) {
    case 'active':
      return { status: 'ACTIVE', endDate: { gte: today } };
    case 'renewals':
      return { status: 'ACTIVE', endDate: { gte: today, lte: addDays(today, noticeDays) } };
    case 'unpaid':
      return { status: 'ACTIVE', endDate: { gte: today }, paidAt: null };
    case 'expired':
      return { OR: [{ status: 'EXPIRED' }, { status: 'ACTIVE', endDate: { lt: today } }] };
    case 'cancelled':
      return { status: 'CANCELLED' };
    case 'all':
      return {};
  }
}

export async function listMemberships(view: MemberView, now: Date, noticeDays: number) {
  const today = startOfUtcDay(now);
  const rows = await db.membership.findMany({
    where: { ...whereFor(view, today, noticeDays), partner: { archivedAt: null } },
    orderBy: [{ endDate: 'asc' }],
    include: {
      partner: { select: { id: true, name: true, sector: true } },
      tier: { select: { name: true, year: true } },
      deal: { select: { id: true, year: true, entity: true } },
    },
  });

  // Which partners already have next year's membership deal - so "Renew"
  // turns into "Renewal open" rather than inviting a duplicate.
  const renewalKeys = new Set(
    (
      await db.deal.findMany({
        where: {
          partnerId: { in: rows.map((row) => row.partnerId) },
          askType: 'CORPORATE_MEMBERSHIP',
          stage: { not: 'LOST' },
        },
        select: { partnerId: true, year: true },
      })
    ).map((deal) => `${deal.partnerId}:${deal.year}`),
  );

  return rows.map((row) => {
    const renewalYear = (row.deal?.year ?? row.endDate.getUTCFullYear()) + 1;
    return {
      ...row,
      effectiveStatus: effectiveMembershipStatus(row, now),
      renewalDue: isRenewalDue(row, now, noticeDays),
      daysLeft: daysBetween(now, row.endDate),
      renewalYear,
      renewalOpen: renewalKeys.has(`${row.partnerId}:${renewalYear}`),
    };
  });
}

export type MembershipRow = Awaited<ReturnType<typeof listMemberships>>[number];

export async function memberCounts(now: Date, noticeDays: number) {
  const today = startOfUtcDay(now);
  const counts = await Promise.all(
    MEMBER_VIEWS.map((view) =>
      db.membership.count({
        where: { ...whereFor(view, today, noticeDays), partner: { archivedAt: null } },
      }),
    ),
  );
  const active = await db.membership.aggregate({
    where: { ...whereFor('active', today, noticeDays), partner: { archivedAt: null } },
    _sum: { amountMinor: true },
  });
  const unpaid = await db.membership.aggregate({
    where: { ...whereFor('unpaid', today, noticeDays), partner: { archivedAt: null } },
    _sum: { amountMinor: true },
  });
  return {
    byView: Object.fromEntries(
      MEMBER_VIEWS.map((view, index) => [view, counts[index] ?? 0]),
    ) as Record<MemberView, number>,
    activeValueMinor: active._sum.amountMinor ?? 0,
    unpaidValueMinor: unpaid._sum.amountMinor ?? 0,
  };
}
