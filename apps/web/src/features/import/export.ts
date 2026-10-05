import 'server-only';
import {
  ASK_TYPE_CODE,
  minorToDollarsInput,
  PARTNER_CSV_COLUMNS,
  toCsv,
  toDateInput,
} from '@partners/core';
import { db, type Prisma } from '@partners/db';
import type { PipelineFilters } from '@/features/deals/queries';

/**
 * The pipeline as a file: one row per deal, in the import format (the
 * Appendix A columns first) plus a few read-only columns at the end. Editing
 * the file and importing it back updates partners and adds missing deals;
 * the extra columns are ignored on the way in.
 *
 * Unfiltered, partners with no deal get a row of their own, so the file is
 * the whole list.
 */
const EXTRA_COLUMNS = [
  'owner',
  'lost_reason',
  'expected_close',
  'proposal_url',
  'membership_status',
];

export async function buildPipelineCsv(filters: PipelineFilters | null): Promise<string> {
  const dealWhere: Prisma.DealWhereInput = filters
    ? {
        ...(filters.askType ? { askType: filters.askType } : {}),
        ...(filters.entity ? { entity: filters.entity } : {}),
        ...(filters.stage ? { stage: filters.stage } : {}),
        ...(filters.year ? { year: filters.year } : {}),
        ...(filters.owner === 'none'
          ? { ownerId: null }
          : filters.owner
            ? { ownerId: filters.owner }
            : {}),
      }
    : {};
  const partners = await db.partner.findMany({
    where: {
      archivedAt: null,
      ...(filters?.sector ? { sector: filters.sector } : {}),
      ...(filters?.priority ? { priority: filters.priority } : {}),
      ...(filters?.q ? { name: { contains: filters.q, mode: 'insensitive' } } : {}),
    },
    orderBy: { name: 'asc' },
    include: {
      contacts: { orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }], select: { name: true } },
      deals: {
        where: dealWhere,
        orderBy: [{ year: 'asc' }, { createdAt: 'asc' }],
        include: {
          tier: { select: { code: true } },
          owner: { select: { email: true } },
          membership: { select: { status: true } },
        },
      },
    },
  });

  const rows: (string | number | null)[][] = [[...PARTNER_CSV_COLUMNS, ...EXTRA_COLUMNS]];
  for (const partner of partners) {
    const base = {
      name: partner.name,
      sector: partner.sector,
      contacts: partner.contacts.map((contact) => contact.name).join('; '),
      priority: partner.priority,
      existing: partner.existingRelationship ? 1 : 0,
      summary: partner.summary ?? '',
      website: partner.website ?? '',
    };
    if (partner.deals.length === 0) {
      if (filters) continue;
      rows.push(
        PARTNER_CSV_COLUMNS.map((column) =>
          column in base ? base[column as keyof typeof base] : '',
        ),
      );
      continue;
    }
    for (const deal of partner.deals) {
      const values: Record<string, string | number> = {
        ...base,
        ask_type: ASK_TYPE_CODE[deal.askType],
        stage: deal.stage,
        amount_usd: minorToDollarsInput(deal.amountMinor),
        entity: deal.entity,
        year: deal.year,
        deal_title: deal.title,
        tier: deal.tier?.code ?? '',
        next_action: deal.nextAction ?? '',
        next_action_due: toDateInput(deal.nextActionDue),
        owner: deal.owner?.email ?? '',
        lost_reason: deal.lostReason ?? '',
        expected_close: toDateInput(deal.expectedCloseDate),
        proposal_url: deal.proposalUrl ?? '',
        membership_status: deal.membership?.status ?? '',
      };
      rows.push([...PARTNER_CSV_COLUMNS, ...EXTRA_COLUMNS].map((column) => values[column] ?? ''));
    }
  }
  return toCsv(rows);
}
