/**
 * Fenêtre d'une période : quelles transactions comptent dans ses totaux.
 * Règle unique, partagée par le prévu, la composition, la simulation, la
 * répartition, l'évolution et les anomalies (spec factures-reservees).
 *
 * Une transaction compte dans une période si sa date est >= au début et si :
 *  - la période n'a pas de fin, ou
 *  - la date est <= à la fin, ou
 *  - la période est active et le montant est strictement négatif (une dépense
 *    déjà saisie est une somme réservée, même datée après la fin).
 *
 * Les montants sont en centimes entiers (bigint).
 */

export interface WindowPeriod {
  startDate: Date;
  endDate: Date | null;
  isActive: boolean;
}

export interface WindowTransaction {
  date: Date;
  amount: bigint;
}

export function isInPeriodWindow(
  t: WindowTransaction,
  period: WindowPeriod,
): boolean {
  if (t.date < period.startDate) return false;
  if (!period.endDate) return true;
  if (t.date <= period.endDate) return true;
  return period.isActive && t.amount < 0n;
}

/**
 * Borne haute à demander au dépôt : aucune pour une période active (les
 * dépenses après la fin doivent être chargées ; le revenu tardif est écarté
 * ensuite par `isInPeriodWindow`), la fin sinon.
 */
export function periodLoadEndDate(period: WindowPeriod): Date | undefined {
  if (period.isActive) return undefined;
  return period.endDate ?? undefined;
}

export interface LateIncomeTransaction extends WindowTransaction {
  reconciled: boolean;
}

/**
 * Revenu pointé daté après la fin d'une période active : hors de la fenêtre (donc hors du
 * prévu), mais déjà dans la banque, donc compté dans « En banque » / « À venir » et annulé
 * dans la composition (« Arrivé après la fin »). Une dépense tardive est déjà dans la
 * fenêtre ; un revenu non pointé tardif reste ignoré partout ; une période fermée n'en a pas.
 */
export function isLateReconciledIncome(
  t: LateIncomeTransaction,
  period: WindowPeriod,
): boolean {
  return (
    period.isActive &&
    period.endDate !== null &&
    t.date > period.endDate &&
    t.reconciled &&
    t.amount > 0n
  );
}

export function filterPeriodWindow<T extends WindowTransaction>(
  transactions: T[],
  period: WindowPeriod,
): T[] {
  return transactions.filter((t) => isInPeriodWindow(t, period));
}
