import 'server-only';
import { addDays, clock, OPEN_STAGES, startOfUtcDay } from '@partners/core';
import { db } from '@partners/db';
import { getSettings } from '@/features/settings/service';

export interface BadgeCounts {
  overdue: number;
  renewals: number;
}

/** The two counts the sidebar shows on every page: two indexed `count`s. */
export async function getBadgeCounts(): Promise<BadgeCounts> {
  const today = startOfUtcDay(clock.now());
  const { renewalNoticeDays } = await getSettings();
  const [overdue, renewals] = await Promise.all([
    db.deal.count({
      where: {
        stage: { in: [...OPEN_STAGES] },
        nextActionDue: { lt: today },
        partner: { archivedAt: null },
      },
    }),
    db.membership.count({
      where: {
        status: 'ACTIVE',
        endDate: { gte: today, lte: addDays(today, renewalNoticeDays) },
      },
    }),
  ]);
  return { overdue, renewals };
}
