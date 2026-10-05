import 'server-only';
import { DEFAULT_RENEWAL_NOTICE_DAYS, DEFAULT_STALE_DAYS } from '@partners/core';
import { db } from '@partners/db';

/**
 * Workspace settings, read from `AppSetting` with code defaults behind them so
 * a missing row (a fresh database, a key added later) is never an error.
 */
export interface WorkspaceSettings {
  /** The 2027 booked-revenue target, in cents. `null` = not set yet. */
  annualTargetMinor: number | null;
  renewalNoticeDays: number;
  staleDays: number;
}

export const SETTING_KEYS = ['annualTargetMinor', 'renewalNoticeDays', 'staleDays'] as const;

function asPositiveInt(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : fallback;
}

export async function getSettings(): Promise<WorkspaceSettings> {
  const rows = await db.appSetting.findMany({ where: { key: { in: [...SETTING_KEYS] } } });
  const map = new Map(rows.map((row) => [row.key, row.value]));
  const target = map.get('annualTargetMinor');
  return {
    annualTargetMinor:
      typeof target === 'number' && Number.isInteger(target) && target >= 0 ? target : null,
    renewalNoticeDays: asPositiveInt(map.get('renewalNoticeDays'), DEFAULT_RENEWAL_NOTICE_DAYS),
    staleDays: asPositiveInt(map.get('staleDays'), DEFAULT_STALE_DAYS),
  };
}
