/**
 * Calendar-date helpers. Follow-up dues, close dates and membership terms are
 * `@db.Date` columns - a day, not an instant - so they are always handled as
 * UTC midnight. "Today" is the UTC day of `clock.now()`, which keeps "overdue"
 * the same answer for everyone looking at the same screen.
 */

export const HOUR_MS = 3_600_000;
export const DAY_MS = 24 * HOUR_MS;

/** UTC midnight of the day `date` falls on. */
export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/**
 * Calendar months, clamped to the end of a shorter month: 31 Jan + 1 month is
 * 28/29 Feb, and 29 Feb 2028 + 12 months is 28 Feb 2029.
 */
export function addMonths(date: Date, months: number): Date {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + months;
  const targetYear = year + Math.floor(month / 12);
  const targetMonth = ((month % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return new Date(
    Date.UTC(
      targetYear,
      targetMonth,
      Math.min(date.getUTCDate(), lastDay),
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds(),
    ),
  );
}

/** Whole days from `from` to `to` (negative when `to` is earlier), by UTC day. */
export function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfUtcDay(to).getTime() - startOfUtcDay(from).getTime()) / DAY_MS);
}

/** `YYYY-MM-DD`, the value an `<input type="date">` reads and writes. */
export function toDateInput(date: Date | string | null | undefined): string {
  if (!date) return '';
  const value = typeof date === 'string' ? new Date(date) : date;
  return Number.isNaN(value.getTime()) ? '' : value.toISOString().slice(0, 10);
}

const DATE_INPUT = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parses `YYYY-MM-DD` as UTC midnight; anything else is `null`. */
export function parseDateInput(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = DATE_INPUT.exec(value.trim());
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  // Rejects 2027-02-31 rather than letting it roll into March.
  return date.getUTCMonth() === Number(m) - 1 ? date : null;
}
