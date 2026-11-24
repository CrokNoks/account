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

/**
 * Short calendar date in the language ("6 nov." in fr, "Nov 6" in en); the year is added only when
 * it differs from the current one ("6 nov. 2025"). The current year is read in UTC, not in the local
 * time zone: server and browser then agree on New Year's night (no hydration mismatch). `now` is injectable.
 */
export function formatShortDate(value: string, locale: string, now: Date = new Date()): string {
  const match = DATE_ONLY.exec(value);
  if (!match) return value;
  const [, year, month, day] = match;
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    ...(Number(year) !== now.getUTCFullYear() ? { year: 'numeric' as const } : {}),
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))));
}

/** Two short dates joined by an arrow ("25 oct. → 24 nov."); without an end, the start alone. */
export function formatShortRange(start: string, end: string | null | undefined, locale: string, now: Date = new Date()): string {
  if (!end) return formatShortDate(start, locale, now);
  return `${formatShortDate(start, locale, now)} → ${formatShortDate(end, locale, now)}`;
}
