import 'server-only';
import { db } from '@partners/db';

export interface TierOption {
  id: string;
  name: string;
  year: number;
  priceMinor: number;
  isActive: boolean;
}

/** Tiers a deal can be given: active ones, newest year first, in display order. */
export async function listTierOptions(): Promise<TierOption[]> {
  return db.membershipTier.findMany({
    where: { isActive: true },
    orderBy: [{ year: 'desc' }, { sortOrder: 'asc' }, { priceMinor: 'desc' }],
    select: { id: true, name: true, year: true, priceMinor: true, isActive: true },
  });
}

export async function listAllTiers() {
  return db.membershipTier.findMany({
    orderBy: [{ year: 'desc' }, { sortOrder: 'asc' }, { priceMinor: 'desc' }],
    include: { _count: { select: { deals: true, memberships: true } } },
  });
}
