import { dateOnly, dayOfMonthDateOnly, daysInMonthDateOnly } from './date-only';

/**
 * Jour du mois effectif d'une récurrente dans le mois de `reference` (date
 * calendaire, voir `date-only.ts`) : le jour demandé, ramené au dernier jour
 * du mois s'il n'existe pas (31 → 30 avril, 28 ou 29 février).
 */
export function recurringDayInMonth(
  dayOfMonth: number,
  reference: Date,
): number {
  return Math.min(dayOfMonth, daysInMonthDateOnly(reference));
}

/** Vrai si la récurrente tombe le jour `date` (une seule fois par mois). */
export function isRecurringDueOn(dayOfMonth: number, date: Date): boolean {
  return dayOfMonthDateOnly(date) === recurringDayInMonth(dayOfMonth, date);
}

/**
 * Dates où une récurrente tombe dans [start, end] (bornes comprises), par ordre
 * croissant : une par mois civil touché, le jour demandé ramené au dernier jour
 * d'un mois court. Une période à cheval sur deux mois (25 oct. → 24 nov.) garde
 * donc le jour 5 de novembre ; une période de plus d'un mois en donne plusieurs.
 */
export function recurringOccurrences(
  dayOfMonth: number,
  start: Date,
  end: Date,
): Date[] {
  const dates: Date[] = [];
  let year = start.getUTCFullYear();
  let month = start.getUTCMonth() + 1;
  const last = end.getUTCFullYear() * 12 + end.getUTCMonth();
  while (year * 12 + month - 1 <= last) {
    const first = dateOnly(year, month, 1);
    const date = dateOnly(year, month, recurringDayInMonth(dayOfMonth, first));
    if (date >= start && date <= end) dates.push(date);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return dates;
}
