import { Period } from '@/features/periods/model/types';

/** Périodes fermées, de la plus ancienne à la plus récente (ordre chronologique). */
export function closedPeriodsChronological(periods: Period[] | undefined): Period[] {
  return (periods ?? [])
    .filter((p) => !p.isActive)
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
}

/**
 * Plage par défaut : P2 = dernière période clôturée, P1 = celle située 6 rangs
 * avant (7 barres), ou la plus ancienne s'il y en a moins. Null sans période fermée.
 */
export function defaultOverrunsRange(closed: Period[]): { startId: string; endId: string } | null {
  if (closed.length === 0) return null;
  const last = closed.length - 1;
  return { startId: closed[Math.max(0, last - 6)].id, endId: closed[last].id };
}

/** P1 après P2 : refusé (jamais permuté en silence). */
export function isRangeInverted(closed: Period[], startId: string, endId: string): boolean {
  const s = closed.findIndex((p) => p.id === startId);
  const e = closed.findIndex((p) => p.id === endId);
  return s !== -1 && e !== -1 && s > e;
}
