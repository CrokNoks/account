import type { Period } from './types';

const day = (iso: string) => iso.split('T')[0];

/** Source unique côté écran : une période inactive ne se réactive que si aucune autre ne commence après elle (comme l'API). */
export function canReactivate(period: Pick<Period, 'id' | 'startDate'>, periods: Pick<Period, 'id' | 'startDate'>[]): boolean {
  return !periods.some((p) => p.id !== period.id && day(p.startDate) > day(period.startDate));
}
