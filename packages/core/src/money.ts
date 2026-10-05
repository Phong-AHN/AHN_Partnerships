/**
 * Money is integer cents everywhere it is stored (`amountMinor`). These two
 * are the only places a dollar string becomes cents and back, so a form, the
 * CSV import and the seed all round the same way.
 */

/** `"50,000"`, `"$50000.00"`, `"50000"` → 5_000_000. Empty → `null`. Garbage → `NaN`. */
export function dollarsToMinor(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? Math.round(value * 100) : NaN;
  const cleaned = value.trim().replace(/^\$/, '').replace(/,/g, '').trim();
  if (cleaned === '') return null;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return NaN;
  return Math.round(Number(cleaned) * 100);
}

/** 5_000_000 → `"50000"`; 1_050 → `"10.50"`. For a form's default value. */
export function minorToDollarsInput(amountMinor: number | null | undefined): string {
  if (amountMinor === null || amountMinor === undefined) return '';
  const dollars = amountMinor / 100;
  return Number.isInteger(dollars) ? String(dollars) : dollars.toFixed(2);
}
