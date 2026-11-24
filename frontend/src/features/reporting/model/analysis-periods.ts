import { Period } from '@/features/periods/model/types';

/** Périodes fermées, de la plus ancienne à la plus récente (ordre chronologique). */
export function closedPeriodsChronological(periods: Period[] | undefined): Period[] {
  return (periods ?? [])
    .filter((p) => !p.isActive)
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
}

export interface DefaultComparison {
  /** Période affichée ; null sans période fermée. */
  periodId: string | null;
  /** Période de comparaison ; null avec une seule période fermée (ou aucune). */
  compareWithId: string | null;
}

/**
 * Choix par défaut de Répartition : la dernière période fermée face à la précédente.
 * La période active n'est jamais choisie par défaut.
 */
export function defaultComparison(periods: Period[] | undefined): DefaultComparison {
  const closed = closedPeriodsChronological(periods);
  if (closed.length === 0) return { periodId: null, compareWithId: null };
  return {
    periodId: closed[closed.length - 1].id,
    compareWithId: closed.length >= 2 ? closed[closed.length - 2].id : null,
  };
}

/**
 * Période de comparaison valable pour la période affichée : jamais la période elle-même
 * (les écarts seraient tous à 0 %). Si elle est identique, on prend la précédente disponible, sinon aucune.
 */
export function validCompareWith(periods: Period[] | undefined, periodId: string, compareWithId: string | null): string | null {
  if (compareWithId === null || compareWithId !== periodId) return compareWithId;
  const chrono = [...(periods ?? [])].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  const index = chrono.findIndex((p) => p.id === periodId);
  return index > 0 ? chrono[index - 1].id : null;
}

/** Nombre de périodes fermées proposées dans les écrans d'analyse (les plus récentes). */
export const ANALYSIS_MAX_PERIODS = 6;

export interface AnalysisSpan {
  count: number;
  /** Date de début de la plus ancienne et de la plus récente période proposées. */
  from: string;
  to: string;
}

/** Périodes fermées réellement proposées (6 au plus), de la plus ancienne à la plus récente ; `null` s'il n'y en a aucune. */
export function analysisSpan(periods: Period[] | undefined): AnalysisSpan | null {
  const proposed = closedPeriodsChronological(periods).slice(-ANALYSIS_MAX_PERIODS);
  if (proposed.length === 0) return null;
  return { count: proposed.length, from: proposed[0].startDate, to: proposed[proposed.length - 1].startDate };
}
