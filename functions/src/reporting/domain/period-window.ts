/**
 * Fenêtre d'une période : quelles transactions comptent dans ses totaux.
 * Règle unique, partagée par le prévu, la composition, la simulation, la
 * répartition, l'évolution, les anomalies, le détail d'un tag, le rythme de
 * dépense et la liste Opérations (spec rattachement-par-dates).
 *
 * Dans l'ordre :
 *  1. date < début : hors ;
 *  2. période fermée : date <= fin (sans fin : tout ce qui suit le début) ;
 *  3. période active : la fin n'est qu'indicative, tout compte sauf la
 *     prochaine paie (`isNextPaie`).
 *
 * Dates sans heure, bornes incluses. La règle ne touche pas aux montants.
 */

export interface WindowPeriod {
  startDate: Date;
  endDate: Date | null;
  isActive: boolean;
  /** Catégorie déclencheuse du compte, null s'il n'y en a pas. */
  triggerCategoryId: string | null;
}

export interface WindowTransaction {
  date: Date;
  pending: boolean;
  categoryId?: string | null;
  metadata?: Record<string, any>;
}

/** Construit la période de fenêtre à partir de la période et des catégories du compte. */
export function toWindowPeriod(
  period: { startDate: Date; endDate: Date | null; isActive: boolean },
  categories: Array<{ id: string; isPeriodTrigger: boolean }>,
): WindowPeriod {
  return {
    startDate: period.startDate,
    endDate: period.endDate,
    isActive: period.isActive,
    triggerCategoryId: categories.find((c) => c.isPeriodTrigger)?.id ?? null,
  };
}

/**
 * Prochaine paie : transaction `pending` de la catégorie déclencheuse, créée par une
 * récurrente (`recurringId`), datée strictement après la fin d'une période active.
 */
export function isNextPaie(
  t: WindowTransaction,
  period: WindowPeriod,
): boolean {
  return (
    period.isActive &&
    period.endDate !== null &&
    period.triggerCategoryId !== null &&
    t.pending &&
    t.categoryId === period.triggerCategoryId &&
    !!t.metadata?.recurringId &&
    t.date > period.endDate
  );
}

export function isInPeriodWindow(
  t: WindowTransaction,
  period: WindowPeriod,
): boolean {
  if (t.date < period.startDate) return false;
  if (!period.isActive) return !period.endDate || t.date <= period.endDate;
  return !isNextPaie(t, period);
}

/**
 * Borne haute à demander au dépôt : aucune pour une période active (ce qui suit
 * la fin doit être chargé, la prochaine paie est écartée ensuite par
 * `isInPeriodWindow`), la fin sinon.
 */
export function periodLoadEndDate(period: {
  endDate: Date | null;
  isActive: boolean;
}): Date | undefined {
  if (period.isActive) return undefined;
  return period.endDate ?? undefined;
}

export function filterPeriodWindow<T extends WindowTransaction>(
  transactions: T[],
  period: WindowPeriod,
): T[] {
  return transactions.filter((t) => isInPeriodWindow(t, period));
}
