import 'server-only';
import {
  addDays,
  ASK_TYPES,
  DEAL_STAGES,
  ENTITIES,
  isOverdue,
  isStale,
  OPEN_STAGES,
  PRIORITIES,
  SECTORS,
  startOfUtcDay,
  type AskType,
  type DealStage,
  type Entity,
  type Priority,
  type Sector,
} from '@partners/core';
import { db, type Prisma } from '@partners/db';

export type SearchParams = Record<string, string | string[] | undefined>;

export const DUE_FILTERS = ['overdue', 'week', 'stale'] as const;
export type DueFilter = (typeof DUE_FILTERS)[number];

export interface PipelineFilters {
  q: string | null;
  sector: Sector | null;
  priority: Priority | null;
  askType: AskType | null;
  entity: Entity | null;
  stage: DealStage | null;
  year: number | null;
  /** A user id, or "none" for unassigned. `me` is resolved on parse. */
  owner: string | null;
  due: DueFilter | null;
  view: 'board' | 'table';
}

function first(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && raw.trim() ? raw.trim() : null;
}

function pick<T extends string>(values: readonly T[], raw: string | null): T | null {
  return raw && (values as readonly string[]).includes(raw) ? (raw as T) : null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parsePipelineFilters(params: SearchParams, principalId: string): PipelineFilters {
  const rawOwner = first(params.owner);
  const rawYear = Number(first(params.year));
  return {
    q: first(params.q),
    sector: pick(SECTORS, first(params.sector)),
    priority: pick(PRIORITIES, first(params.priority)),
    askType: pick(ASK_TYPES, first(params.ask)),
    entity: pick(ENTITIES, first(params.entity)),
    stage: pick(DEAL_STAGES, first(params.stage)),
    year: Number.isInteger(rawYear) && rawYear > 2000 ? rawYear : null,
    owner:
      rawOwner === 'me'
        ? principalId
        : rawOwner === 'none' || (rawOwner && UUID.test(rawOwner))
          ? rawOwner
          : null,
    due: pick(DUE_FILTERS, first(params.due)),
    view: first(params.view) === 'table' ? 'table' : 'board',
  };
}

export async function listDeals(filters: PipelineFilters, now: Date, staleDays: number) {
  const today = startOfUtcDay(now);
  const where: Prisma.DealWhereInput = {
    partner: {
      archivedAt: null,
      ...(filters.sector ? { sector: filters.sector } : {}),
      ...(filters.priority ? { priority: filters.priority } : {}),
    },
    ...(filters.askType ? { askType: filters.askType } : {}),
    ...(filters.entity ? { entity: filters.entity } : {}),
    ...(filters.stage ? { stage: filters.stage } : {}),
    ...(filters.year ? { year: filters.year } : {}),
    ...(filters.owner === 'none'
      ? { ownerId: null }
      : filters.owner
        ? { ownerId: filters.owner }
        : {}),
    ...(filters.due === 'overdue'
      ? { stage: { in: [...OPEN_STAGES] }, nextActionDue: { lt: today } }
      : filters.due === 'week'
        ? { stage: { in: [...OPEN_STAGES] }, nextActionDue: { lte: addDays(today, 7) } }
        : filters.due === 'stale'
          ? { stage: { in: [...OPEN_STAGES] } }
          : {}),
    ...(filters.q
      ? {
          OR: [
            { title: { contains: filters.q, mode: 'insensitive' } },
            { nextAction: { contains: filters.q, mode: 'insensitive' } },
            { partner: { name: { contains: filters.q, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };

  const deals = await db.deal.findMany({
    where,
    orderBy: [{ nextActionDue: { sort: 'asc', nulls: 'last' } }, { partner: { name: 'asc' } }],
    select: {
      id: true,
      title: true,
      year: true,
      entity: true,
      askType: true,
      stage: true,
      amountMinor: true,
      tierId: true,
      nextAction: true,
      nextActionDue: true,
      expectedCloseDate: true,
      stageChangedAt: true,
      createdAt: true,
      lostReason: true,
      partner: { select: { id: true, name: true, sector: true, priority: true } },
      tier: { select: { id: true, name: true } },
      owner: { select: { id: true, name: true } },
    },
  });

  // "Last touched" is the partner's latest activity - one grouped query for
  // the whole list rather than one per card.
  const partnerIds = [...new Set(deals.map((deal) => deal.partner.id))];
  const latest = partnerIds.length
    ? await db.activity.groupBy({
        by: ['partnerId'],
        where: { partnerId: { in: partnerIds } },
        _max: { occurredAt: true },
      })
    : [];
  const lastByPartner = new Map(latest.map((row) => [row.partnerId, row._max.occurredAt]));

  const items = deals.map((deal) => {
    const candidates = [lastByPartner.get(deal.partner.id), deal.stageChangedAt, deal.createdAt];
    const lastTouchedAt = new Date(
      Math.max(...candidates.filter((d): d is Date => d instanceof Date).map((d) => d.getTime())),
    );
    return {
      ...deal,
      lastTouchedAt,
      overdue: isOverdue(deal, now),
      stale: isStale({ stage: deal.stage, lastTouchedAt }, now, staleDays),
    };
  });

  return filters.due === 'stale' ? items.filter((item) => item.stale) : items;
}

export type PipelineDeal = Awaited<ReturnType<typeof listDeals>>[number];

export async function listDealYears(): Promise<number[]> {
  const rows = await db.deal.findMany({
    distinct: ['year'],
    select: { year: true },
    orderBy: { year: 'desc' },
  });
  return rows.map((row) => row.year);
}
