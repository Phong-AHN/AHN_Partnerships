/**
 * A small RFC 4180 reader and writer - quoted fields, doubled quotes, commas
 * and newlines inside quotes, CRLF or LF, an optional UTF-8 BOM. Enough for
 * what a spreadsheet exports, without a dependency.
 */

export function parseCsv(text: string): string[][] {
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let i = 0;

  while (i < input.length) {
    const char = input[i]!;
    if (quoted) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i += 1;
        continue;
      }
      field += char;
      i += 1;
      continue;
    }

    if (char === '"' && field === '') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      if (char === '\r' && input[i + 1] === '\n') i += 1;
    } else {
      field += char;
    }
    i += 1;
  }

  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // A trailing newline, or blank lines a spreadsheet leaves, are not rows.
  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ''));
}

/**
 * Cells a spreadsheet would run as a formula get a leading apostrophe - the
 * export goes to people who open it in Excel, and a partner name is not a
 * place a formula should come from.
 */
function guardFormula(value: string): string {
  return /^[=@\t\r]/.test(value) || /^[+-][^\d\s]/.test(value) ? `'${value}` : value;
}

function escapeCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  const text = guardFormula(String(value));
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(
  rows: readonly (readonly (string | number | boolean | null | undefined)[])[],
): string {
  return rows.map((row) => row.map(escapeCell).join(',')).join('\r\n') + '\r\n';
}
