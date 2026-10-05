import 'server-only';
import {
  isClosedStage,
  PRIORITIES,
  SECTORS,
  type DealStage,
  type Priority,
  type Sector,
} from '@partners/core';
import { db, type Prisma } from '@partners/db';

export type SearchParams = Record<string, string | string[] | undefined>;

export interface PartnerFilters {
  q: string | null;
  sector: Sector | null;
  priority: Priority | null;
  archived: boolean;
}

function first(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && raw.trim() ? raw.trim() : null;
}

function pick<T extends string>(values: readonly T[], raw: string | null): T | null {
  return raw && (values as readonly string[]).includes(raw) ? (raw as T) : null;
}

export function parsePartnerFilters(params: SearchParams): PartnerFilters {
  return {
    q: first(params.q),
    sector: pick(SECTORS, first(params.sector)),
    priority: pick(PRIORITIES, first(params.priority)),
    archived: first(params.archived) === '1',
  };
}

export async function listPartners(filters: PartnerFilters) {
  const where: Prisma.PartnerWhereInput = {
    archivedAt: filters.archived ? { not: null } : null,
    ...(filters.sector ? { sector: filters.sector } : {}),
    ...(filters.priority ? { priority: filters.priority } : {}),
    ...(filters.q
      ? {
          OR: [
            { name: { contains: filters.q, mode: 'insensitive' } },
            { summary: { contains: filters.q, mode: 'insensitive' } },
            { contacts: { some: { name: { contains: filters.q, mode: 'insensitive' } } } },
            { contacts: { some: { email: { contains: filters.q, mode: 'insensitive' } } } },
          ],
        }
      : {}),
  };

  const rows = await db.partner.findMany({
    where,
    orderBy: [{ priority: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      sector: true,
      priority: true,
      summary: true,
      existingRelationship: true,
      archivedAt: true,
      owner: { select: { id: true, name: true } },
      _count: { select: { contacts: true } },
      deals: {
        orderBy: [{ year: 'desc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          title: true,
          year: true,
          stage: true,
          askType: true,
          amountMinor: true,
          nextAction: true,
          nextActionDue: true,
          tier: { select: { name: true } },
        },
      },
    },
  });

  return rows.map((row) => ({
    ...row,
    /** The deal to show in the list: the most recent open one, else the most recent. */
    currentDeal:
      row.deals.find((deal) => !isClosedStage(deal.stage as DealStage)) ?? row.deals[0] ?? null,
  }));
}

export type PartnerListItem = Awaited<ReturnType<typeof listPartners>>[number];

export async function getPartner(partnerId: string) {
  return db.partner.findUnique({
    where: { id: partnerId },
    include: {
      owner: { select: { id: true, name: true } },
      contacts: { orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }] },
      deals: {
        orderBy: [{ year: 'desc' }, { createdAt: 'desc' }],
        include: {
          tier: { select: { id: true, name: true, year: true, priceMinor: true } },
          owner: { select: { id: true, name: true } },
          membership: { select: { id: true, status: true } },
        },
      },
      memberships: {
        orderBy: { startDate: 'desc' },
        include: { tier: { select: { name: true, year: true } } },
      },
      activities: {
        orderBy: { occurredAt: 'desc' },
        take: 200,
        include: {
          author: { select: { name: true } },
          deal: { select: { id: true, title: true } },
        },
      },
    },
  });
}

export type PartnerDetail = NonNullable<Awaited<ReturnType<typeof getPartner>>>;
