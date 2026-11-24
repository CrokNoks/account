import type { Period } from './types';

/** Fin à afficher : la date de fin, sinon la fin estimée, sinon `null` (jamais d'affichage de « null »). */
export function periodEnd(period: Pick<Period, 'endDate' | 'estimatedEndDate'>): string | null {
  return period.endDate ?? period.estimatedEndDate ?? null;
}
