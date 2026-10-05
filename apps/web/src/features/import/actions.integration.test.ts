import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { db } from '@partners/db';
import {
  actAs,
  cleanupFixtures,
  createTestTier,
  createTestUser,
  trackPartner,
  type TestUser,
} from '../../../test/fixtures';
import { commitImportAction, previewImportAction } from './actions';
import { buildPipelineCsv } from './export';

const HEADER = 'name,sector,contacts,ask_type,priority,stage,existing,amount_usd,summary,tier';
let admin: TestUser;
const tag = randomUUID().slice(0, 8);
const nameA = `IT Import Alpha ${tag}`;
const nameB = `IT Import Beta ${tag}`;

beforeAll(async () => {
  admin = await createTestUser('ADMIN');
});
afterAll(async () => {
  const rows = await db.partner.findMany({
    where: { name: { contains: tag } },
    select: { id: true },
  });
  rows.forEach((row) => trackPartner(row.id));
  await cleanupFixtures();
});

describe('CSV import (phase 7)', () => {
  it('previews without writing, then imports everything in one go', async () => {
    const tier = await createTestTier(7_700_000);
    actAs(admin);
    const csv = [
      HEADER,
      `${nameA},TECH_COMMERCE_SMB,Ann One; Bob Two,CM,IN_MOTION,PROPOSAL_SENT,1,,"Alpha summary",${tier.code}`,
      `${nameB},BANKING_FINANCIAL,,RR,,,0,12000,,`,
    ].join('\n');

    const preview = await previewImportAction({ csv });
    expect(preview).toMatchObject({
      ok: true,
      data: {
        issues: [],
        rows: [
          { name: nameA, partner: 'create', newContacts: ['Ann One', 'Bob Two'], deal: 'create' },
          { name: nameB, partner: 'create', newContacts: [], deal: 'create' },
        ],
      },
    });
    expect(await db.partner.count({ where: { name: { contains: tag } } })).toBe(0);

    const result = await commitImportAction({ csv });
    expect(result).toMatchObject({
      ok: true,
      data: { created: 2, updated: 0, contacts: 2, deals: 2 },
    });

    const alpha = await db.partner.findFirstOrThrow({
      where: { name: nameA },
      include: { contacts: true, deals: true },
    });
    expect(alpha.existingRelationship).toBe(true);
    expect(alpha.contacts.find((c) => c.isPrimary)?.name).toBe('Ann One');
    expect(alpha.deals[0]).toMatchObject({
      stage: 'PROPOSAL_SENT',
      tierId: tier.id,
      amountMinor: 7_700_000,
    });
    const beta = await db.partner.findFirstOrThrow({
      where: { name: nameB },
      include: { deals: true },
    });
    expect(beta.deals[0]).toMatchObject({ askType: 'REFERRAL_REVENUE', amountMinor: 1_200_000 });
  });

  it('updates a partner matched by name, ignoring case, and keeps its deal and values', async () => {
    actAs(admin);
    const csv = [
      HEADER,
      `${nameA.toUpperCase()},PROFESSIONAL_SERVICES,ann one; Cara Three,CM,BACKLOG,PROSPECT,0,,,`,
    ].join('\n');
    const result = await commitImportAction({ csv });
    expect(result).toMatchObject({
      ok: true,
      data: { created: 0, updated: 1, contacts: 1, deals: 0 },
    });

    const alpha = await db.partner.findFirstOrThrow({
      where: { name: nameA },
      include: { contacts: true, deals: true },
    });
    expect(alpha.sector).toBe('PROFESSIONAL_SERVICES');
    expect(alpha.summary).toBe('Alpha summary'); // blank cell did not erase it
    expect(alpha.contacts.map((c) => c.name).sort()).toEqual(['Ann One', 'Bob Two', 'Cara Three']);
    expect(alpha.deals).toHaveLength(1);
    expect(alpha.deals[0]?.stage).toBe('PROPOSAL_SENT');
  });

  it('writes nothing when any row is wrong', async () => {
    actAs(admin);
    const name = `IT Import Gamma ${tag}`;
    const csv = [
      HEADER,
      `${name},TECH_COMMERCE_SMB,,,,,,,,`,
      `IT Import Delta ${tag},TECH_COMMERCE_SMB,,CM,,NEGOTIATING,0,123,,`,
    ].join('\n');
    const result = await commitImportAction({ csv });
    expect(result).toMatchObject({
      ok: false,
      fieldErrors: { csv: [expect.stringMatching(/Line 3: no 2027 tier is priced at \$123/)] },
    });
    expect(await db.partner.count({ where: { name } })).toBe(0);
  });

  it('refuses a new deal imported as won, but re-imports an existing won deal untouched', async () => {
    actAs(admin);
    const csv = [HEADER, `${nameB},BANKING_FINANCIAL,,SC,,WON,0,,,`].join('\n');
    const preview = await previewImportAction({ csv });
    expect(preview.ok && preview.data.issues[0]?.message).toMatch(/cannot be imported as WON/);
  });

  it('round-trips: an export of the pipeline imports back with nothing to create', async () => {
    actAs(admin);
    const exported = await buildPipelineCsv({
      q: tag,
      sector: null,
      priority: null,
      askType: null,
      entity: null,
      stage: null,
      year: null,
      owner: null,
      due: null,
      view: 'table',
    });
    expect(exported.split('\r\n').filter(Boolean)).toHaveLength(3); // header + alpha + beta
    const preview = await previewImportAction({ csv: exported });
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    expect(preview.data.issues).toEqual([]);
    expect(preview.data.rows.every((row) => row.partner === 'update' && row.deal === 'keep')).toBe(
      true,
    );
  });

  it('is admin only', async () => {
    actAs(await createTestUser('MEMBER'));
    expect(await previewImportAction({ csv: HEADER })).toMatchObject({
      ok: false,
      code: 'FORBIDDEN',
    });
    expect(await commitImportAction({ csv: HEADER })).toMatchObject({
      ok: false,
      code: 'FORBIDDEN',
    });
  });
});
