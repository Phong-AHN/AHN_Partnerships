'use server';

import { z } from 'zod';
import { ValidationError } from '@partners/core';
import { db, transaction } from '@partners/db';
import { actionOk, defineAction } from '@/server/action';
import { applyImport, planImport } from './plan';

/** ~2 MB of CSV is thousands of partners - far beyond what this app holds. */
const csvText = z
  .string({ required_error: 'Choose a CSV file.' })
  .min(1, 'The file is empty.')
  .max(2_000_000, 'That file is too large for a partner list (2 MB max).');

export const previewImportAction = defineAction({
  name: 'import.preview',
  permission: 'data:import',
  input: z.object({ csv: csvText }),
  handler: async ({ csv }) => {
    // A read-only plan: nothing is written.
    const plan = await planImport(db, csv);
    return actionOk(plan);
  },
});

export const commitImportAction = defineAction({
  name: 'import.commit',
  permission: 'data:import',
  input: z.object({ csv: csvText }),
  handler: async ({ csv }, ctx) => {
    // Everything in one transaction: one bad row means nothing is written.
    const result = await transaction((tx) => applyImport(tx, csv, ctx.principal, ctx.ip));
    if (Array.isArray(result)) {
      throw new ValidationError('The file has problems - nothing was imported.', {
        csv: result.map((issue) => `Line ${issue.line}: ${issue.message}`),
      });
    }
    return actionOk(
      result,
      `Imported: ${result.created} new partners, ${result.updated} updated, ${result.contacts} contacts, ${result.deals} deals.`,
    );
  },
});
