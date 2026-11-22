import { spentAmount } from '../lib/budget-surplus';
import { ComparisonPoint, PeriodComparisonResponse } from './types';

const ZERO = BigInt(0);
const abs = (value: bigint) => (value < ZERO ? -value : value);

/** Valeur absolue d'un montant en centimes (chaîne), sans passer par un flottant. */
export function absCents(cents: string): string {
  return abs(BigInt(cents)).toString();
}

/** Ligne de la répartition : `isSavings` distingue l'épargne de la dépense (couleur neutre des écarts). */
export type BreakdownRow = ComparisonPoint & { isSavings: boolean };

export interface Breakdown {
  /** Catégories de dépense et d'épargne ayant un montant sur l'une des deux périodes, plus gros montant d'abord. */
  rows: BreakdownRow[];
  /** Total dépensé de la période affichée (centimes, positif). */
  total: string;
  /** Total dépensé de la période de comparaison (centimes, positif). */
  compareTotal: string;
}

/**
 * Répartition : « dépensé » = catégories de dépense et d'épargne de la réponse de comparaison.
 * Les écarts viennent du back (`percentageDiff`), rien n'est recalculé ici.
 * `period2Real` = période affichée, `period1Real` = période de comparaison.
 */
export function buildBreakdown(comparison: PeriodComparisonResponse): Breakdown {
  const all: BreakdownRow[] = [
    ...comparison.expenses.map((p) => ({ ...p, isSavings: false })),
    ...comparison.savings.map((p) => ({ ...p, isSavings: true })),
  ];
  // Règle unique `spentAmount` : un réel positif (remboursement) ne consomme rien et ne vient pas en déduction.
  const sum = (pick: (p: BreakdownRow) => string) => all.reduce((acc, p) => acc + spentAmount(BigInt(pick(p))), ZERO);
  const rows = all
    .filter((p) => BigInt(p.period2Real) !== ZERO || BigInt(p.period1Real) !== ZERO)
    .sort((a, b) => {
      const diff = spentAmount(BigInt(b.period2Real)) - spentAmount(BigInt(a.period2Real));
      return diff === ZERO ? a.name.localeCompare(b.name) : diff > ZERO ? 1 : -1;
    });
  return {
    rows,
    total: sum((p) => p.period2Real).toString(),
    compareTotal: sum((p) => p.period1Real).toString(),
  };
}
