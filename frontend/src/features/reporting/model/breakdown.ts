import { ComparisonPoint, PeriodComparisonResponse } from './types';

const ZERO = BigInt(0);
const abs = (value: bigint) => (value < ZERO ? -value : value);

/** Valeur absolue d'un montant en centimes (chaîne), sans passer par un flottant. */
export function absCents(cents: string): string {
  return abs(BigInt(cents)).toString();
}

export interface Breakdown {
  /** Catégories de dépense et d'épargne ayant un montant sur l'une des deux périodes, plus gros montant d'abord. */
  rows: ComparisonPoint[];
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
  const all = [...comparison.expenses, ...comparison.savings];
  const sum = (pick: (p: ComparisonPoint) => string) => all.reduce((acc, p) => acc + BigInt(pick(p)), ZERO);
  const rows = all
    .filter((p) => BigInt(p.period2Real) !== ZERO || BigInt(p.period1Real) !== ZERO)
    .sort((a, b) => {
      const diff = abs(BigInt(b.period2Real)) - abs(BigInt(a.period2Real));
      return diff === ZERO ? a.name.localeCompare(b.name) : diff > ZERO ? 1 : -1;
    });
  return {
    rows,
    total: abs(sum((p) => p.period2Real)).toString(),
    compareTotal: abs(sum((p) => p.period1Real)).toString(),
  };
}
