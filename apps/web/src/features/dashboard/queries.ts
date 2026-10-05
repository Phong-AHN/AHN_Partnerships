import 'server-only';
import {
  addDays,
  ASK_TYPES,
  OPEN_STAGES,
  PIPELINE_STAGES,
  SECTORS,
  STAGE_PROBABILITY,
  startOfUtcDay,
  type AskType,
  type DealStage,
  type Sector,
} from '@partners/core';
import { db } from '@partners/db';

/**
 * Everything the dashboard shows, as grouped counts and sums computed in
 * Postgres - the deals themselves never travel to the browser. The only rows
 * fetched are the two short lists (due this week, renewals).
 */
export async function getDashboard(year: number, now: Date, renewalNoticeDays: number) {
  const today = startOfUtcDay(now);
  const live = { partner: { archivedAt: null } } as const;

  const [byStage, byAsk, bySector, activeMembers, overdue, dueSoon, renewals, tierless] =
    await Promise.all([
      db.deal.groupBy({
        by: ['stage'],
        where: { ...live, year },
        _count: { _all: true },
        _sum: { amountMinor: true },
      }),
      db.deal.groupBy({
        by: ['askType'],
        where: { ...live, year, stage: { not: 'LOST' } },
        _count: { _all: true },
        _sum: { amountMinor: true },
      }),
      db.partner.groupBy({
        by: ['sector'],
        where: { archivedAt: null },
        _count: { _all: true },
      }),
      db.membership.count({ where: { ...live, status: 'ACTIVE', endDate: { gte: today } } }),
      db.deal.count({
        where: { ...live, stage: { in: [...OPEN_STAGES] }, nextActionDue: { lt: today } },
      }),
      db.deal.findMany({
        where: {
          ...live,
          stage: { in: [...OPEN_STAGES] },
          nextActionDue: { lte: addDays(today, 7) },
        },
        orderBy: [{ nextActionDue: 'asc' }, { partner: { name: 'asc' } }],
        take: 30,
        select: {
          id: true,
          title: true,
          stage: true,
          askType: true,
          nextAction: true,
          nextActionDue: true,
          partner: { select: { id: true, name: true } },
          owner: { select: { name: true } },
        },
      }),
      db.membership.findMany({
        where: {
          ...live,
          status: 'ACTIVE',
          endDate: { gte: today, lte: addDays(today, renewalNoticeDays) },
        },
        orderBy: { endDate: 'asc' },
        select: {
          id: true,
          endDate: true,
          amountMinor: true,
          paidAt: true,
          partner: { select: { id: true, name: true } },
          tier: { select: { name: true } },
        },
      }),
      db.deal.count({
        where: {
          ...live,
          year,
          askType: 'CORPORATE_MEMBERSHIP',
          tierId: null,
          stage: { in: [...OPEN_STAGES] },
        },
      }),
    ]);

  const stageRow = new Map(byStage.map((row) => [row.stage as DealStage, row]));
  const funnel = PIPELINE_STAGES.map((stage) => ({
    stage,
    count: stageRow.get(stage)?._count._all ?? 0,
    amountMinor: stageRow.get(stage)?._sum.amountMinor ?? 0,
  }));

  const bookedMinor = stageRow.get('WON')?._sum.amountMinor ?? 0;
  const openStages = funnel.filter((row) => OPEN_STAGES.includes(row.stage));
  const pipelineMinor = openStages.reduce((sum, row) => sum + row.amountMinor, 0);
  const weightedMinor = Math.round(
    openStages.reduce((sum, row) => sum + row.amountMinor * STAGE_PROBABILITY[row.stage], 0),
  );
  const openDeals = openStages.reduce((sum, row) => sum + row.count, 0);

  const askRow = new Map(byAsk.map((row) => [row.askType as AskType, row]));
  const sectorRow = new Map(bySector.map((row) => [row.sector as Sector, row._count._all]));

  return {
    year,
    bookedMinor,
    wonCount: stageRow.get('WON')?._count._all ?? 0,
    pipelineMinor,
    weightedMinor,
    openDeals,
    activeMembers,
    overdue,
    tierless,
    funnel,
    byAsk: ASK_TYPES.map((askType) => ({
      askType,
      count: askRow.get(askType)?._count._all ?? 0,
      amountMinor: askRow.get(askType)?._sum.amountMinor ?? 0,
    })),
    bySector: SECTORS.map((sector) => ({ sector, count: sectorRow.get(sector) ?? 0 })),
    dueSoon,
    renewals,
  };
}
