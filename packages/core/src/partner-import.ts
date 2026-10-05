import { parseCsv } from './csv';
import { parseDateInput } from './dates';
import {
  ASK_TYPES,
  DEAL_STAGES,
  ENTITIES,
  PRIORITIES,
  SECTORS,
  type AskType,
  type DealStage,
  type Entity,
  type Priority,
  type Sector,
} from './enums';
import { ASK_TYPE_LABEL } from './labels';
import { dollarsToMinor } from './money';
import { DEFAULT_YEAR, isClosedStage, needsTier } from './pipeline';

/**
 * The partner CSV format - the columns of the plan's Appendix A, plus a few
 * optional ones the export writes so an export can be edited and imported
 * back. One reader for the seed, the import screen and the tests, so all
 * three agree on what a row means.
 */

export const PARTNER_CSV_REQUIRED_COLUMNS = ['name', 'sector'] as const;

export const PARTNER_CSV_COLUMNS = [
  'name',
  'sector',
  'contacts',
  'ask_type',
  'priority',
  'stage',
  'existing',
  'amount_usd',
  'summary',
  'website',
  'entity',
  'year',
  'deal_title',
  'tier',
  'next_action',
  'next_action_due',
] as const;

const ASK_TYPE_CODES: Record<string, AskType> = {
  CM: 'CORPORATE_MEMBERSHIP',
  RR: 'REFERRAL_REVENUE',
  SC: 'STRATEGIC_COMMUNITY',
};

export const ASK_TYPE_CODE: Record<AskType, string> = {
  CORPORATE_MEMBERSHIP: 'CM',
  REFERRAL_REVENUE: 'RR',
  STRATEGIC_COMMUNITY: 'SC',
};

export interface PartnerImportRow {
  /** 1-based line in the file, header included - what a spreadsheet shows. */
  line: number;
  name: string;
  sector: Sector;
  contacts: string[];
  priority: Priority;
  existingRelationship: boolean;
  summary: string | null;
  website: string | null;
  /** `null` when the row has no `ask_type`: the partner is imported without a deal. */
  deal: {
    askType: AskType;
    stage: DealStage;
    year: number;
    entity: Entity;
    title: string;
    amountMinor: number | null;
    tierCode: string | null;
    nextAction: string | null;
    nextActionDue: Date | null;
  } | null;
}

export interface ImportIssue {
  line: number;
  message: string;
}

export interface ParsedPartnerCsv {
  rows: PartnerImportRow[];
  issues: ImportIssue[];
}

export function defaultDealTitle(year: number, askType: AskType): string {
  switch (askType) {
    case 'CORPORATE_MEMBERSHIP':
      return `${year} Corporate Membership`;
    case 'REFERRAL_REVENUE':
      return `${year} Referral / Revenue Partnership`;
    case 'STRATEGIC_COMMUNITY':
      return `${year} Strategic / Community Partnership`;
  }
}

/** `"Tony Chopp; Vivian Young"` → two names. */
export function splitContacts(value: string): string[] {
  return value
    .split(';')
    .map((name) => name.trim())
    .filter(Boolean);
}

function oneOf<T extends string>(values: readonly T[], raw: string): T | null {
  const normalised = raw
    .trim()
    .toUpperCase()
    .replace(/[\s/-]+/g, '_');
  return (values as readonly string[]).includes(normalised) ? (normalised as T) : null;
}

function parseBoolean(raw: string): boolean | null {
  const value = raw.trim().toLowerCase();
  if (['', '0', 'false', 'no', 'n'].includes(value)) return false;
  if (['1', 'true', 'yes', 'y'].includes(value)) return true;
  return null;
}

export function parsePartnerCsv(text: string): ParsedPartnerCsv {
  const table = parseCsv(text);
  const issues: ImportIssue[] = [];
  const rows: PartnerImportRow[] = [];

  const header = table[0]?.map((cell) => cell.trim().toLowerCase());
  if (!header) {
    return { rows, issues: [{ line: 1, message: 'The file is empty.' }] };
  }
  const missing = PARTNER_CSV_REQUIRED_COLUMNS.filter((column) => !header.includes(column));
  if (missing.length > 0) {
    return {
      rows,
      issues: [
        {
          line: 1,
          message: `Missing column${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}.`,
        },
      ],
    };
  }

  const index = new Map(header.map((column, position) => [column, position]));
  const seen = new Map<string, number>();

  table.slice(1).forEach((cells, offset) => {
    const line = offset + 2;
    const get = (column: string) => {
      const position = index.get(column);
      return position === undefined ? '' : (cells[position] ?? '').trim();
    };
    const problems: string[] = [];

    const name = get('name');
    if (!name) problems.push('name is empty');
    const key = name.toLowerCase();
    if (name && seen.has(key)) problems.push(`"${name}" is also on line ${seen.get(key)}`);
    if (name) seen.set(key, line);

    const sector = oneOf(SECTORS, get('sector'));
    if (!sector) problems.push(`sector "${get('sector')}" is not one of ${SECTORS.join(', ')}`);

    const rawPriority = get('priority');
    const priority = rawPriority ? oneOf(PRIORITIES, rawPriority) : 'BACKLOG';
    if (!priority)
      problems.push(`priority "${rawPriority}" is not one of ${PRIORITIES.join(', ')}`);

    const existing = parseBoolean(get('existing'));
    if (existing === null) problems.push(`existing "${get('existing')}" should be 1 or 0`);

    const rawAsk = get('ask_type');
    const askType = rawAsk
      ? (ASK_TYPE_CODES[rawAsk.toUpperCase()] ?? oneOf(ASK_TYPES, rawAsk))
      : null;
    if (rawAsk && !askType) problems.push(`ask_type "${rawAsk}" should be CM, RR or SC`);

    const rawStage = get('stage');
    const stage = rawStage ? oneOf(DEAL_STAGES, rawStage) : 'PROSPECT';
    if (!stage) problems.push(`stage "${rawStage}" is not one of ${DEAL_STAGES.join(', ')}`);
    if (stage && isClosedStage(stage)) {
      problems.push(
        `stage ${stage} cannot be imported - close deals in the app so WON creates the membership`,
      );
    }

    const amountMinor = dollarsToMinor(get('amount_usd'));
    if (amountMinor !== null && Number.isNaN(amountMinor)) {
      problems.push(`amount_usd "${get('amount_usd')}" is not a dollar amount`);
    }

    const rawEntity = get('entity');
    const entity = rawEntity ? oneOf(ENTITIES, rawEntity) : 'AHN';
    if (!entity) problems.push(`entity "${rawEntity}" should be AHN, AHNF or BOTH`);

    const rawYear = get('year');
    const year = rawYear ? Number(rawYear) : DEFAULT_YEAR;
    if (!Number.isInteger(year) || year < 2000 || year > 2100)
      problems.push(`year "${rawYear}" is not a year`);

    const rawDue = get('next_action_due');
    const nextActionDue = parseDateInput(rawDue);
    if (rawDue && !nextActionDue) problems.push(`next_action_due "${rawDue}" should be YYYY-MM-DD`);

    const tierCode = get('tier') || null;
    if (
      askType &&
      stage &&
      needsTier(askType, stage) &&
      !tierCode &&
      (amountMinor === null || Number.isNaN(amountMinor))
    ) {
      problems.push(
        `a ${ASK_TYPE_LABEL[askType].label.toLowerCase()} deal at ${stage} needs a tier - fill tier or amount_usd`,
      );
    }

    if (problems.length > 0 || !sector || !priority || existing === null || !stage || !entity) {
      issues.push({ line, message: problems.join('; ') });
      return;
    }

    rows.push({
      line,
      name,
      sector,
      contacts: splitContacts(get('contacts')),
      priority,
      existingRelationship: existing,
      summary: get('summary') || null,
      website: get('website') || null,
      deal: askType
        ? {
            askType,
            stage,
            year,
            entity,
            title: get('deal_title') || defaultDealTitle(year, askType),
            amountMinor: amountMinor === null || Number.isNaN(amountMinor) ? null : amountMinor,
            tierCode,
            nextAction: get('next_action') || null,
            nextActionDue,
          }
        : null,
    });
  });

  return { rows, issues };
}
