/**
 * Converts a CSV date to YYYY-MM-DD. Accepts dd/mm/yyyy, dd/mm/yy (20yy) and
 * ISO dates (YYYY-MM-DD, optional time). Returns null when unreadable or when
 * the day/month do not exist (31/02/2026).
 */
export function parseImportDate(input: string): string | null {
  const value = input.trim();
  let y: string, m: string, d: string;

  let match = /^(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})$/.exec(value);
  if (match) {
    [, d, m, y] = match;
    if (y.length === 2) y = '20' + y;
  } else {
    match = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/.exec(value);
    if (!match) return null;
    [, y, m, d] = match;
  }

  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}
