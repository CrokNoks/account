/**
 * Business dates (transaction date, period bounds...) are calendar dates sent
 * as `YYYY-MM-DD` (or an ISO string at midnight UTC). They are read and written
 * from their calendar fields, never through the time zone of the browser.
 */

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})/;

/** Today's calendar date in the browser's time zone, as `YYYY-MM-DD`. */
export function todayDateOnly(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * Formats a calendar date for display in the given language (fr: 01/10/2026,
 * en: 10/01/2026). Anything that is not a date is returned unchanged.
 */
export function formatDateOnly(value: string, locale: string): string {
  const match = DATE_ONLY.exec(value);
  if (!match) return value;
  const [, year, month, day] = match;
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))));
}
