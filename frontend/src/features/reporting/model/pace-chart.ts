import { formatCurrency } from '@/shared/lib/format';

export interface PacePointInput {
  day: number;
  cumulative: string;
  previousCumulative: string | null;
}

export interface PaceChartPoint {
  day: number;
  /** Position tracée uniquement (nombre) : jamais affichée, le texte vient de `currentCents`. */
  current: number;
  previous: number | null;
  /** Montants exacts en centimes (chaînes), source du texte de l'infobulle. */
  currentCents: string;
  previousCents: string | null;
}

/** Points du graphique : la position tracée est un nombre, le montant exact reste en chaîne de centimes. */
export function paceChartData(points: PacePointInput[]): PaceChartPoint[] {
  return points.map((p) => ({
    day: p.day,
    current: Number(p.cumulative),
    previous: p.previousCumulative === null ? null : Number(p.previousCumulative),
    currentCents: p.cumulative,
    previousCents: p.previousCumulative,
  }));
}

/** Texte de l'infobulle d'une série, depuis le montant exact (jamais depuis la position tracée). */
export function paceTooltipAmount(point: PaceChartPoint, series: 'current' | 'previous'): string {
  const cents = series === 'previous' ? point.previousCents : point.currentCents;
  return cents === null ? '' : formatCurrency(BigInt(cents));
}
