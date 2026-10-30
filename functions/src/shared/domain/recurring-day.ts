import { getDate, getDaysInMonth } from 'date-fns';

/**
 * Jour du mois effectif d'une récurrente dans le mois de `reference` : le jour
 * demandé, ramené au dernier jour du mois s'il n'existe pas (31 → 30 avril,
 * 28 ou 29 février).
 */
export function recurringDayInMonth(
  dayOfMonth: number,
  reference: Date,
): number {
  return Math.min(dayOfMonth, getDaysInMonth(reference));
}

/** Vrai si la récurrente tombe le jour `date` (une seule fois par mois). */
export function isRecurringDueOn(dayOfMonth: number, date: Date): boolean {
  return getDate(date) === recurringDayInMonth(dayOfMonth, date);
}
