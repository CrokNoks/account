import { dayOfMonthDateOnly, daysInMonthDateOnly } from './date-only';

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
