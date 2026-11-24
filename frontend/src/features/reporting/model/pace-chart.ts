import { formatCurrency } from '@/shared/lib/format';

export interface PacePointInput {
  day: number;
  /** Date du jour tracé (`YYYY-MM-DD`), pour l'axe horizontal. */
  date?: string;
  cumulative: string;
  previousCumulative: string | null;
}

export interface PaceChartPoint {
  day: number;
  date: string | null;
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
    date: p.date ?? null,
    current: Number(p.cumulative),
    previous: p.previousCumulative === null ? null : Number(p.previousCumulative),
    currentCents: p.cumulative,
    previousCents: p.previousCumulative,
  }));
}

/** Texte de l'infobulle d'une série, depuis le montant exact (jamais depuis la position tracée). */
export function paceTooltipAmount(point: PaceChartPoint, series: 'current' | 'previous', locale = 'fr'): string {
  const cents = series === 'previous' ? point.previousCents : point.currentCents;
  return cents === null ? '' : formatCurrency(BigInt(cents), locale);
}

/** Jours repères de l'axe : environ `count`, du premier au dernier jour tracé, sans doublon. */
export function paceTicks(data: PaceChartPoint[], count: number): number[] {
  if (data.length <= count) return data.map((p) => p.day);
  const last = data.length - 1;
  const indexes = Array.from({ length: count }, (_, i) => Math.round((i * last) / (count - 1)));
  return [...new Set(indexes)].map((i) => data[i].day);
}

/** Haut de l'échelle verticale : le plus grand cumul tracé ou le budget (la ligne Budget doit rester visible). */
export function paceYMax(data: PaceChartPoint[], budget: string | null): number {
  const plotted = data.reduce((max, p) => Math.max(max, p.current, p.previous ?? 0), 0);
  return budget === null ? plotted : Math.max(plotted, Number(budget));
}
