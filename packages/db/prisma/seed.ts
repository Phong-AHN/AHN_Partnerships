/**
 * Seeds a fresh database with what the app needs on day one:
 *
 *   - the membership tiers (PLAN.md §5.3 - placeholders until real pricing),
 *   - the first admin, from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD,
 *   - workspace settings (target, renewal notice, stale threshold),
 *   - the 50 partners from Bryan's 3 Oct 2026 checklist (PLAN.md Appendix A),
 *     each with its contacts and one 2027 deal.
 *
 * Idempotent: a tier, user, setting or partner that already exists is left as
 * it is, so running it twice - or against production after people have
 * started editing - never overwrites real work.
 */
import { readFileSync } from 'node:fs';
import { randomBytes, scryptSync } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRootEnv } from '@partners/config';
import { PrismaClient, type Prisma } from '@prisma/client';
import { parsePartnerCsv, PRIORITY_LABEL } from '@partners/core';

loadRootEnv();

const db = new PrismaClient();
const here = dirname(fileURLToPath(import.meta.url));

/** Same format as @partners/auth's hashPassword - inlined to avoid a db -> auth cycle. */
function hashPassword(password: string): string {
  const N = 2 ** 15;
  const salt = randomBytes(16);
  const derived = scryptSync(password.normalize('NFKC'), salt, 64, {
    N,
    r: 8,
    p: 1,
    maxmem: 256 * 1024 * 1024,
  });
  return ['scrypt', N, 8, 1, salt.toString('base64'), derived.toString('base64')].join('$');
}

const TIERS = [
  {
    code: 'PLATINUM_2027',
    name: 'Platinum',
    priceMinor: 5_000_000,
    sortOrder: 1,
    benefits: [
      'Title recognition across AHN/AHNF flagship events',
      'Speaking slot at the annual summit',
      'Featured partner profile and newsletter placement',
      'Member referrals and founder introductions',
    ],
  },
  {
    code: 'GOLD_2027',
    name: 'Gold',
    priceMinor: 2_500_000,
    sortOrder: 2,
    benefits: [
      'Logo recognition at AHN events',
      'Panel participation at one event',
      'Newsletter placement',
    ],
  },
  {
    code: 'SILVER_2027',
    name: 'Silver',
    priceMinor: 1_000_000,
    sortOrder: 3,
    benefits: ['Logo recognition at AHN events', 'Member directory listing'],
  },
  {
    code: 'COMMUNITY_2027',
    name: 'Community',
    priceMinor: 500_000,
    sortOrder: 4,
    benefits: ['Member directory listing', 'Community event invitations'],
  },
];

const SETTINGS: Record<string, Prisma.InputJsonValue> = {
  // Placeholder until the real 2027 target is agreed (PLAN.md §2 question 7).
  annualTargetMinor: 50_000_000,
  renewalNoticeDays: 60,
  staleDays: 21,
};

/** The "Immediate follow-up priority - already in motion" list, verbatim. */
const IN_MOTION_ACTIONS: Record<string, string> = {
  Azurium: 'Close the $50K proposal',
  'MidFirst Bank': 'Follow up on membership + advisor ask',
  Comcast: 'Follow up with Joon',
  'BMO / Elavon': 'Convert referral relationship into 2027 corporate partnership',
  ADP: 'Convert sponsorship/affiliate relationship into annual partnership',
};

function utcDay(offsetDays: number): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offsetDays));
}

async function seedTiers() {
  for (const tier of TIERS) {
    await db.membershipTier.upsert({
      where: { code: tier.code },
      create: { ...tier, year: 2027 },
      update: {},
    });
  }
  console.log(`tiers: ${TIERS.length} ensured`);
}

async function seedAdmin(): Promise<string | null> {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    console.warn('admin: SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set - skipped');
    return null;
  }
  if (password.length < 12) throw new Error('SEED_ADMIN_PASSWORD must be at least 12 characters.');

  const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    console.log(`admin: ${email} already exists - left as is`);
    return existing.id;
  }
  const user = await db.user.create({
    data: {
      email,
      name: process.env.SEED_ADMIN_NAME?.trim() || 'AHN Admin',
      passwordHash: hashPassword(password),
      role: 'ADMIN',
    },
  });
  console.log(`admin: created ${email}`);
  return user.id;
}

async function seedSettings() {
  for (const [key, value] of Object.entries(SETTINGS)) {
    await db.appSetting.upsert({ where: { key }, create: { key, value }, update: {} });
  }
}

async function seedPartners(adminId: string | null) {
  const csv = readFileSync(join(here, 'partners-2027.csv'), 'utf8');
  const { rows, issues } = parsePartnerCsv(csv);
  if (issues.length > 0) {
    throw new Error(
      `partners-2027.csv has problems:\n${issues.map((i) => `  line ${i.line}: ${i.message}`).join('\n')}`,
    );
  }

  const tiers = await db.membershipTier.findMany();
  let created = 0;
  let contacts = 0;

  for (const row of rows) {
    const existing = await db.partner.findFirst({
      where: { name: { equals: row.name, mode: 'insensitive' } },
      select: { id: true },
    });
    if (existing) continue;

    const deal = row.deal;
    const tier =
      deal && deal.askType === 'CORPORATE_MEMBERSHIP' && deal.amountMinor !== null
        ? tiers.find((t) => t.priceMinor === deal.amountMinor && t.year === deal.year)
        : undefined;
    if (deal?.askType === 'CORPORATE_MEMBERSHIP' && deal.amountMinor !== null && !tier) {
      throw new Error(`${row.name}: no ${deal.year} tier priced at ${deal.amountMinor / 100}.`);
    }

    const nextAction =
      IN_MOTION_ACTIONS[row.name] ??
      (row.priority === 'NEXT_OUTREACH'
        ? 'First outreach - tailor the ask to the relationship'
        : row.priority === 'OPPORTUNITY'
          ? 'Plan the approach'
          : null);
    const nextActionDue =
      row.priority === 'IN_MOTION'
        ? utcDay(3)
        : row.priority === 'NEXT_OUTREACH'
          ? utcDay(14)
          : row.priority === 'OPPORTUNITY'
            ? utcDay(30)
            : null;

    await db.$transaction(async (tx) => {
      const partner = await tx.partner.create({
        data: {
          name: row.name,
          sector: row.sector,
          priority: row.priority,
          existingRelationship: row.existingRelationship,
          summary: row.summary,
          website: row.website,
          contacts: {
            create: row.contacts.map((name, index) => ({ name, isPrimary: index === 0 })),
          },
        },
      });
      contacts += row.contacts.length;

      if (!deal) return;
      const created = await tx.deal.create({
        data: {
          partnerId: partner.id,
          title: deal.title,
          year: deal.year,
          entity: deal.entity,
          askType: deal.askType,
          stage: deal.stage,
          tierId: tier?.id ?? null,
          // A membership deal's amount is always the tier's price.
          amountMinor: tier ? tier.priceMinor : deal.amountMinor,
          nextAction: deal.nextAction ?? nextAction,
          nextActionDue: deal.nextActionDue ?? nextActionDue,
        },
      });
      await tx.activity.create({
        data: {
          partnerId: partner.id,
          dealId: created.id,
          type: 'DEAL_CREATED',
          authorId: adminId,
          body: `Imported from Bryan's 2027 partnership checklist (3 Oct 2026) - priority ${PRIORITY_LABEL[row.priority].label.toLowerCase()}.`,
        },
      });
    });
    created += 1;
  }

  console.log(`partners: ${created} created, ${rows.length - created} already present`);
  console.log(`contacts: ${contacts} created`);
}

async function main() {
  await seedTiers();
  const adminId = await seedAdmin();
  await seedSettings();
  await seedPartners(adminId);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
