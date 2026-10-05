import { afterAll, describe, expect, it } from 'vitest';
import { db } from '@partners/db';
import {
  actAs,
  cleanupFixtures,
  createTestPartner,
  createTestUser,
  trackPartner,
  uniqueName,
} from '../../../test/fixtures';
import { logActivityAction } from '../activity/actions';
import {
  archivePartnerAction,
  createPartnerAction,
  deleteContactAction,
  updatePartnerAction,
  upsertContactAction,
} from './actions';

afterAll(cleanupFixtures);

describe('partners, contacts and notes (phase 3 acceptance)', () => {
  it('creates a partner, adds two contacts, logs a note and shows it on the timeline', async () => {
    const member = await createTestUser('MEMBER');
    actAs(member);

    const name = uniqueName('Acme');
    const created = await createPartnerAction({
      name,
      sector: 'TECH_COMMERCE_SMB',
      priority: 'NEXT_OUTREACH',
      website: 'acme.example',
      existingRelationship: 'on',
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    trackPartner(created.data.id);
    const partnerId = created.data.id;

    for (const contact of [
      { name: 'Ada Lovelace', email: 'ADA@acme.example', isPrimary: 'on' },
      { name: 'Grace Hopper', title: 'CTO', isPrimary: 'on' },
    ]) {
      expect((await upsertContactAction({ partnerId, ...contact })).ok).toBe(true);
    }

    const note = await logActivityAction({ partnerId, type: 'NOTE', body: 'Intro call booked.' });
    expect(note.ok).toBe(true);

    const partner = await db.partner.findUniqueOrThrow({
      where: { id: partnerId },
      include: { contacts: true, activities: true },
    });
    expect(partner.website).toBe('https://acme.example/');
    expect(partner.existingRelationship).toBe(true);
    expect(partner.contacts).toHaveLength(2);
    // Choosing Grace as primary demoted Ada.
    expect(partner.contacts.filter((c) => c.isPrimary).map((c) => c.name)).toEqual([
      'Grace Hopper',
    ]);
    expect(partner.contacts.find((c) => c.name === 'Ada Lovelace')?.email).toBe('ada@acme.example');
    expect(partner.activities).toEqual([
      expect.objectContaining({ type: 'NOTE', body: 'Intro call booked.', authorId: member.id }),
    ]);
  });

  it('refuses a duplicate name regardless of case, as a field error', async () => {
    actAs(await createTestUser('MEMBER'));
    const existing = await createTestPartner();
    const result = await createPartnerAction({
      name: existing.name.toUpperCase(),
      sector: 'TECH_COMMERCE_SMB',
      priority: 'BACKLOG',
    });
    expect(result).toMatchObject({
      ok: false,
      fieldErrors: { name: [expect.stringMatching(/already exists/)] },
    });
  });

  it('reports bad input per field rather than failing the whole form', async () => {
    actAs(await createTestUser('MEMBER'));
    const result = await createPartnerAction({
      name: '',
      sector: 'NOPE',
      priority: 'BACKLOG',
      website: 'not a url',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.fieldErrors ?? {})).toEqual(
      expect.arrayContaining(['name', 'sector', 'website']),
    );
  });

  it('refuses a note dated in the future', async () => {
    actAs(await createTestUser('MEMBER'));
    const partner = await createTestPartner();
    const result = await logActivityAction({
      partnerId: partner.id,
      type: 'CALL',
      body: 'x',
      occurredOn: '2999-01-01',
    });
    expect(result).toMatchObject({ ok: false, fieldErrors: { occurredOn: expect.any(Array) } });
  });
});

describe('permissions are enforced by the server, not the UI', () => {
  it('refuses every write from a VIEWER, even when the action is called directly', async () => {
    const partner = await createTestPartner();
    const contact = await db.partnerContact.create({
      data: { partnerId: partner.id, name: 'Kept' },
    });
    actAs(await createTestUser('VIEWER'));

    const attempts = [
      createPartnerAction({
        name: uniqueName('Viewer'),
        sector: 'TECH_COMMERCE_SMB',
        priority: 'BACKLOG',
      }),
      updatePartnerAction({
        id: partner.id,
        name: 'Renamed',
        sector: 'TECH_COMMERCE_SMB',
        priority: 'BACKLOG',
      }),
      upsertContactAction({ partnerId: partner.id, name: 'Sneaky' }),
      deleteContactAction({ id: contact.id }),
      logActivityAction({ partnerId: partner.id, type: 'NOTE', body: 'nope' }),
      archivePartnerAction({ id: partner.id, archived: 'true' }),
    ];
    for (const result of await Promise.all(attempts)) {
      expect(result).toMatchObject({ ok: false, code: 'FORBIDDEN' });
    }

    const after = await db.partner.findUniqueOrThrow({
      where: { id: partner.id },
      include: { contacts: true, activities: true },
    });
    expect(after.name).toBe(partner.name);
    expect(after.archivedAt).toBeNull();
    expect(after.contacts.map((c) => c.name)).toEqual(['Kept']);
    expect(after.activities).toHaveLength(0);
  });

  it('lets only an admin archive', async () => {
    const partner = await createTestPartner();
    actAs(await createTestUser('MEMBER'));
    expect(await archivePartnerAction({ id: partner.id, archived: 'true' })).toMatchObject({
      ok: false,
      code: 'FORBIDDEN',
    });
    actAs(await createTestUser('ADMIN'));
    expect((await archivePartnerAction({ id: partner.id, archived: 'true' })).ok).toBe(true);
    expect(
      (await db.partner.findUniqueOrThrow({ where: { id: partner.id } })).archivedAt,
    ).not.toBeNull();
  });

  it('refuses a signed-out caller', async () => {
    actAs(null);
    expect(await logActivityAction({})).toMatchObject({ ok: false, code: 'UNAUTHENTICATED' });
  });
});
