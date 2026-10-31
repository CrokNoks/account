/**
 * Dates métier (colonnes SQL de type `date`, sans heure) : convention unique.
 *
 * Une date calendaire est représentée par un `Date` à MINUIT UTC
 * (`new Date('2026-11-01')` ; c'est aussi ce que renvoient les lignes lues en
 * base). Toute lecture ou arithmétique passe par les accesseurs UTC ci-dessous :
 * le résultat ne dépend donc jamais du fuseau du serveur. Ne jamais construire
 * ni formater une date métier avec l'heure locale (`startOfDay`, `addDays`,
 * `format`, `new Date(y, m, d)`, `getDate()`) : en UTC+1, minuit local du 1er
 * novembre devient « 2026-10-31 » une fois passé par `toISOString()`.
 *
 * « Aujourd'hui » est la date calendaire dans le fuseau métier
 * (`APP_TIME_ZONE`, `Europe/Paris` par défaut), identique quel que soit le
 * fuseau de la machine.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export function appTimeZone(): string {
  return process.env.APP_TIME_ZONE || 'Europe/Paris';
}

/** Construit une date calendaire (mois de 1 à 12). */
export function dateOnly(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Lit la date calendaire écrite par le client : les 10 premiers caractères
 * d'une chaîne `YYYY-MM-DD` ou ISO (`2026-11-01T00:00:00Z` → 1er novembre).
 */
export function parseDateOnly(value: string | Date): Date {
  if (value instanceof Date) return new Date(toDateOnly(value));
  return new Date(value.slice(0, 10));
}

/** Aujourd'hui (date calendaire du fuseau métier) à minuit UTC. */
export function todayDateOnly(now: Date = new Date()): Date {
  // Format `en-CA` = YYYY-MM-DD
  const key = new Intl.DateTimeFormat('en-CA', {
    timeZone: appTimeZone(),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  return new Date(key);
}

/** `YYYY-MM-DD` de la date calendaire (UTC). */
export function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** `dd/MM/yyyy` de la date calendaire. */
export function formatDateOnlyFr(date: Date): string {
  const [y, m, d] = toDateOnly(date).split('-');
  return `${d}/${m}/${y}`;
}

export function addDaysDateOnly(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/** Ajoute des mois en ramenant le jour au dernier jour du mois si besoin. */
export function addMonthsDateOnly(date: Date, months: number): Date {
  const target = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1),
  );
  const last = daysInMonthDateOnly(target);
  return dateOnly(
    target.getUTCFullYear(),
    target.getUTCMonth() + 1,
    Math.min(date.getUTCDate(), last),
  );
}

export function dayOfMonthDateOnly(date: Date): number {
  return date.getUTCDate();
}

export function daysInMonthDateOnly(date: Date): number {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  ).getUTCDate();
}

export function startOfMonthDateOnly(date: Date): Date {
  return dateOnly(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);
}

export function endOfMonthDateOnly(date: Date): Date {
  return dateOnly(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    daysInMonthDateOnly(date),
  );
}

/** Tous les jours de `start` à `end` inclus. */
export function eachDayDateOnly(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  for (let d = start; d <= end; d = addDaysDateOnly(d, 1)) days.push(d);
  return days;
}
