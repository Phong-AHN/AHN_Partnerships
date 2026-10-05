/**
 * Reads a form the way every action input expects it: trimmed strings, empty
 * fields left out, repeated names collected into an array. Client-side twin
 * of what a server action would see from `FormData`.
 */
export function readForm(form: HTMLFormElement): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const [key, value] of new FormData(form).entries()) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (trimmed === '') continue;
    const existing = values[key];
    if (existing === undefined) values[key] = trimmed;
    else if (Array.isArray(existing)) existing.push(trimmed);
    else values[key] = [existing, trimmed];
  }
  return values;
}

/** First message for a field, for `<Field error>`. */
export function fieldError(errors: Record<string, string[]>, key: string): string | null {
  return errors[key]?.[0] ?? null;
}
