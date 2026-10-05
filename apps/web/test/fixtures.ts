import { randomUUID } from 'node:crypto';
import type { UserRole } from '@partners/core';
import { createSession } from '@partners/auth';
import { db } from '@partners/db';
import type { Principal } from '@partners/rbac';
import { actingAs } from './request-context';

/**
 * Fixture helpers for integration tests. Everything created through this
 * module is tracked so `cleanupFixtures` removes exactly what a test added -
 * never the seeded data, never another test file's rows, even though every
 * file shares one database.
 */

// Never verified - tests mint sessions directly, so the hash only has to
// satisfy the NOT NULL column.
const UNUSED_PASSWORD_HASH = 'scrypt$1$1$1$dW51c2Vk$dW51c2Vk';

export interface TestUser extends Principal {
  token: string;
}

const createdUserIds: string[] = [];
const createdPartnerIds: string[] = [];
const createdTierIds: string[] = [];

export function uniqueName(prefix: string): string {
  return `${prefix} ${randomUUID().slice(0, 8)}`;
}

export async function createTestUser(role: UserRole): Promise<TestUser> {
  const suffix = randomUUID().slice(0, 8);
  const user = await db.user.create({
    data: {
      email: `it-${suffix}@partners.test`,
      name: `Test ${role} ${suffix}`,
      passwordHash: UNUSED_PASSWORD_HASH,
      role,
    },
  });
  createdUserIds.push(user.id);
  const { token } = await createSession(user.id);
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isActive: user.isActive,
    token,
  };
}

/** Makes the next server action call run as this user. */
export function actAs(user: TestUser | null): void {
  actingAs(user?.token);
}

export function trackPartner(id: string): void {
  createdPartnerIds.push(id);
}

export async function createTestPartner(
  data: Partial<{ name: string; sector: 'TECH_COMMERCE_SMB' | 'BANKING_FINANCIAL' }> = {},
) {
  const partner = await db.partner.create({
    data: {
      name: data.name ?? uniqueName('IT Partner'),
      sector: data.sector ?? 'TECH_COMMERCE_SMB',
    },
  });
  createdPartnerIds.push(partner.id);
  return partner;
}

export async function createTestTier(priceMinor = 5_000_000, year = 2027) {
  const suffix = randomUUID().slice(0, 8);
  const tier = await db.membershipTier.create({
    data: {
      code: `IT_${suffix.toUpperCase()}_${year}`,
      name: `IT Tier ${suffix}`,
      year,
      priceMinor,
      benefits: ['Testing'],
    },
  });
  createdTierIds.push(tier.id);
  return tier;
}

export async function cleanupFixtures(): Promise<void> {
  actingAs(undefined);
  if (createdPartnerIds.length > 0) {
    await db.partner.deleteMany({ where: { id: { in: createdPartnerIds } } });
    createdPartnerIds.length = 0;
  }
  if (createdTierIds.length > 0) {
    await db.membershipTier.deleteMany({ where: { id: { in: createdTierIds } } });
    createdTierIds.length = 0;
  }
  if (createdUserIds.length > 0) {
    await db.auditLog.deleteMany({ where: { actorId: { in: createdUserIds } } });
    await db.user.deleteMany({ where: { id: { in: createdUserIds } } });
    createdUserIds.length = 0;
  }
}
