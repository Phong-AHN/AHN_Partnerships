import 'server-only';
import {
  formatMoney,
  isClosedStage,
  parsePartnerCsv,
  type ImportIssue,
  type PartnerImportRow,
} from '@partners/core';
import type { DbTransaction } from '@partners/db';
import type { Principal } from '@partners/rbac';
import { audit, logActivity } from '@/server/record';

/**
 * One plan, two uses: the preview shows it, the commit applies it. Both run
 * the same function against the same database, so what the preview promised
 * is exactly what the commit does - and if anything changed in between, the
 * commit re-plans rather than trusting a stale preview.
 *
 * Rules (PLAN.md §6, phase 7):
 *   - a partner whose name already exists (ignoring case) is updated, never duplicated;
 *   - blank cells never wipe a value already on file;
 *   - contacts are added by name, never removed;
 *   - a deal is created only when the partner has none for that year and ask -
 *     existing deals are left alone, so an export can be re-imported safely.
 */

export interface PlannedRow {
  line: number;
  name: string;
  partner: 'create' | 'update';
  newContacts: string[];
  deal: 'create' | 'keep' | 'none';
  dealSummary: string | null;
}

export interface ImportPlan {
  rows: PlannedRow[];
  issues: ImportIssue[];
}

interface ResolvedRow {
  row: PartnerImportRow;
  partnerId: string | null;
  newContacts: string[];
  createDeal: boolean;
  tier: { id: string; priceMinor: number; name: string } | null;
}

async function resolve(tx: DbTransaction, text: string) {
  const { rows, issues } = parsePartnerCsv(text);
  const resolved: ResolvedRow[] = [];
  if (rows.length === 0) return { resolved, issues };

  const [partners, tiers] = await Promise.all([
    tx.partner.findMany({
      select: {
        id: true,
        name: true,
        contacts: { select: { name: true } },
        deals: { select: { year: true, askType: true } },
      },
    }),
    tx.membershipTier.findMany({
      select: { id: true, code: true, name: true, year: true, priceMinor: true },
    }),
  ]);
  const byName = new Map(partners.map((partner) => [partner.name.toLowerCase(), partner]));

  for (const row of rows) {
    const existing = byName.get(row.name.toLowerCase()) ?? null;
    const known = new Set(existing?.contacts.map((contact) => contact.name.toLowerCase()) ?? []);
    const newContacts = row.contacts.filter((name) => !known.has(name.toLowerCase()));
    const deal = row.deal;
    const createDeal = Boolean(
      deal && !existing?.deals.some((d) => d.year === deal.year && d.askType === deal.askType),
    );

    let tier: ResolvedRow['tier'] = null;
    if (deal && createDeal && deal.askType === 'CORPORATE_MEMBERSHIP') {
      if (deal.tierCode) {
        tier = tiers.find((t) => t.code.toLowerCase() === deal.tierCode!.toLowerCase()) ?? null;
        if (!tier)
          issues.push({ line: row.line, message: `tier "${deal.tierCode}" does not exist` });
      } else if (deal.amountMinor !== null) {
        tier = tiers.find((t) => t.priceMinor === deal.amountMinor && t.year === deal.year) ?? null;
        if (!tier) {
          issues.push({
            line: row.line,
            message: `no ${deal.year} tier is priced at ${formatMoney(deal.amountMinor).replace(/\.00$/, '')} - add the tier first or use the tier column`,
          });
        }
      }
    }
    if (deal && createDeal && isClosedStage(deal.stage)) {
      issues.push({
        line: row.line,
        message: `a new deal cannot be imported as ${deal.stage} - import it open and close it in the app, so WON creates the membership`,
      });
    }

    resolved.push({ row, partnerId: existing?.id ?? null, newContacts, createDeal, tier });
  }
  issues.sort((a, b) => a.line - b.line);
  return { resolved, issues };
}

export async function planImport(tx: DbTransaction, text: string): Promise<ImportPlan> {
  const { resolved, issues } = await resolve(tx, text);
  return {
    issues,
    rows: resolved.map(({ row, partnerId, newContacts, createDeal, tier }) => ({
      line: row.line,
      name: row.name,
      partner: partnerId ? 'update' : 'create',
      newContacts,
      deal: !row.deal ? 'none' : createDeal ? 'create' : 'keep',
      dealSummary: row.deal
        ? `${row.deal.title}${tier ? ` · ${tier.name}` : ''} · ${row.deal.stage}`
        : null,
    })),
  };
}

export async function applyImport(
  tx: DbTransaction,
  text: string,
  principal: Principal,
  ip: string | null,
): Promise<{ created: number; updated: number; contacts: number; deals: number } | ImportIssue[]> {
  const { resolved, issues } = await resolve(tx, text);
  if (issues.length > 0) return issues;

  const counts = { created: 0, updated: 0, contacts: 0, deals: 0 };
  for (const { row, partnerId: existingId, newContacts, createDeal, tier } of resolved) {
    const fields = {
      sector: row.sector,
      priority: row.priority,
      existingRelationship: row.existingRelationship,
      ...(row.summary ? { summary: row.summary } : {}),
      ...(row.website ? { website: row.website } : {}),
    };
    const partnerId = existingId
      ? (await tx.partner.update({ where: { id: existingId }, data: fields, select: { id: true } }))
          .id
      : (await tx.partner.create({ data: { name: row.name, ...fields }, select: { id: true } })).id;
    counts[existingId ? 'updated' : 'created'] += 1;

    if (newContacts.length > 0) {
      const hasPrimary = existingId
        ? (await tx.partnerContact.count({ where: { partnerId, isPrimary: true } })) > 0
        : false;
      await tx.partnerContact.createMany({
        data: newContacts.map((name, index) => ({
          partnerId,
          name,
          isPrimary: !hasPrimary && index === 0,
        })),
      });
      counts.contacts += newContacts.length;
    }

    const deal = row.deal;
    if (deal && createDeal) {
      const isMembership = deal.askType === 'CORPORATE_MEMBERSHIP';
      const created = await tx.deal.create({
        data: {
          partnerId,
          title: deal.title,
          year: deal.year,
          entity: deal.entity,
          askType: deal.askType,
          stage: deal.stage,
          tierId: isMembership ? (tier?.id ?? null) : null,
          amountMinor: isMembership ? (tier?.priceMinor ?? null) : deal.amountMinor,
          nextAction: deal.nextAction,
          nextActionDue: deal.nextActionDue,
        },
      });
      await logActivity(tx, {
        partnerId,
        dealId: created.id,
        type: 'DEAL_CREATED',
        authorId: principal.id,
        body: `${created.title} imported from CSV.`,
      });
      counts.deals += 1;
    }
  }

  await audit(tx, {
    principal,
    action: 'import.partners',
    entityType: 'Partner',
    after: counts,
    ip,
  });
  return counts;
}
