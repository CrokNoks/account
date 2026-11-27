import { BudgetBreakdownResponse, BudgetCategoryBreakdown } from '@/features/reporting/model/types';
import { spentAmount } from '@/features/reporting/lib/budget-surplus';

const abs = (value: string): bigint => {
  const n = BigInt(value);
  return n < BigInt(0) ? -n : n;
};

/** 0 : budget à 0 avec du réel (ratio infini) ; 1 : budget > 0 ; 2 : ni budget ni réel. */
function group(line: BudgetCategoryBreakdown): number {
  if (abs(line.budget) > BigInt(0)) return 1;
  return spent(line) > BigInt(0) ? 0 : 2;
}

/** Consommé d'une ligne : un réel positif (remboursement) ne consomme rien. */
const spent = (line: BudgetCategoryBreakdown): bigint => spentAmount(BigInt(line.real));

const byName = (a: BudgetCategoryBreakdown, b: BudgetCategoryBreakdown) => a.name.localeCompare(b.name);

/**
 * Ordre des dépenses et de l'épargne : % consommé décroissant, comparé par produit croisé en bigint
 * (jamais de flottant). Un budget à 0 avec du réel passe devant, une catégorie sans budget ni réel
 * passe derrière, à égalité l'ordre est celui du nom.
 */
function compareConsumption(a: BudgetCategoryBreakdown, b: BudgetCategoryBreakdown): number {
  const ga = group(a);
  const gb = group(b);
  if (ga !== gb) return ga - gb;
  if (ga === 0) {
    const diff = spent(b) - spent(a);
    return diff > BigInt(0) ? 1 : diff < BigInt(0) ? -1 : byName(a, b);
  }
  if (ga === 1) {
    const left = spent(a) * abs(b.budget);
    const right = spent(b) * abs(a.budget);
    if (left !== right) return left > right ? -1 : 1;
  }
  return byName(a, b);
}

/** Liste unique de l'écran Budgets : dépenses, épargne et virements sortants par consommation, puis revenus et virements entrants par nom. */
export function sortBudgetLines(breakdown: BudgetBreakdownResponse): BudgetCategoryBreakdown[] {
  return sortBudgetRows(breakdown).map((row) => row.line);
}

export interface BudgetRow {
  line: BudgetCategoryBreakdown;
  /** Revenu ou virement entrant : un restant négatif y est un surplus, pas un dépassement. */
  isIncome: boolean;
  /** Ligne de la section « Revenus » (revenu ou virement entrant) : colonnes Réel et Budget, sans « Reste ». */
  isRevenue: boolean;
}

/** Sens d'un virement, calculé par le back (jamais ici) ; absent d'un back plus ancien : entrant. */
const isOutgoing = (line: BudgetCategoryBreakdown) => line.direction === 'outgoing';

export function sortBudgetRows(breakdown: BudgetBreakdownResponse): BudgetRow[] {
  const outgoing = breakdown.transfers.filter(isOutgoing);
  const incoming = breakdown.transfers.filter((line) => !isOutgoing(line));
  const spending = [...breakdown.expenses, ...breakdown.savings, ...outgoing].sort(compareConsumption);
  return [
    ...spending.map((line) => ({ line, isIncome: false, isRevenue: false })),
    ...[...breakdown.income, ...incoming].sort(byName).map((line) => ({ line, isIncome: true, isRevenue: true })),
  ];
}
