import { z } from 'zod';
import { dollarsToMinor, parseDateInput } from '@partners/core';

/**
 * The zod building blocks every action input is made of. Forms send what a
 * browser form sends - trimmed strings, with empty fields left out (see
 * `readForm`) - so an optional field that is missing means "clear it", and
 * each helper turns that into the `null` the database stores.
 */

export const id = z.string().uuid('That record id is not valid.');

export function requiredText(label: string, max = 200) {
  return z
    .string({ required_error: `${label} is required.` })
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} is too long (max ${max} characters).`);
}

export function optionalText(max = 2000) {
  return z
    .string()
    .trim()
    .max(max, `Too long (max ${max} characters).`)
    .optional()
    .transform((value) => (value ? value : null));
}

export const optionalId = z
  .string()
  .uuid('That record id is not valid.')
  .optional()
  .transform((value) => value ?? null);

export const checkbox = z.preprocess(
  (value) => value === true || value === 'on' || value === 'true',
  z.boolean(),
);

export const optionalEmail = z
  .string()
  .trim()
  .email('Enter a valid email address.')
  .optional()
  .transform((value) => (value ? value.toLowerCase() : null));

/** Accepts `example.com` as well as `https://example.com`. */
export const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((value, ctx) => {
    if (!value) return null;
    const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`;
    try {
      const url = new URL(candidate);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('scheme');
      return url.toString();
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a valid web address.' });
      return z.NEVER;
    }
  });

/** `YYYY-MM-DD` → UTC midnight, or `null` when left empty. */
export const optionalDate = z
  .string()
  .optional()
  .transform((value, ctx) => {
    if (!value) return null;
    const date = parseDateInput(value);
    if (!date) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a valid date.' });
      return z.NEVER;
    }
    return date;
  });

export const requiredDate = optionalDate.transform((value, ctx) => {
  if (!value) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Choose a date.' });
    return z.NEVER;
  }
  return value;
});

/** A dollar amount as typed (`50,000`) → cents, or `null` when left empty. */
export const optionalMoney = z
  .union([z.string(), z.number()])
  .optional()
  .transform((value, ctx) => {
    const minor = dollarsToMinor(value ?? null);
    if (minor === null) return null;
    if (Number.isNaN(minor)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Enter a dollar amount, like 25000.',
      });
      return z.NEVER;
    }
    return minor;
  });

export const year = z.coerce
  .number({ invalid_type_error: 'Enter a year.' })
  .int('Enter a year.')
  .min(2020, 'Enter a year from 2020.')
  .max(2100, 'Enter a realistic year.');
