import { BudgetBreakdownResponse, BudgetCategoryBreakdown } from '@/features/reporting/model/types';

const abs = (value: string): bigint => {
  const n = BigInt(value);
  return n < BigInt(0) ? -n : n;
};

/** 0 : budget à 0 avec du réel (ratio infini) ; 1 : budget > 0 ; 2 : ni budget ni réel. */
function group(line: BudgetCategoryBreakdown): number {
  if (abs(line.budget) > BigInt(0)) return 1;
  return abs(line.real) > BigInt(0) ? 0 : 2;
}

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
    const diff = abs(b.real) - abs(a.real);
    return diff > BigInt(0) ? 1 : diff < BigInt(0) ? -1 : byName(a, b);
  }
  if (ga === 1) {
    const left = abs(a.real) * abs(b.budget);
    const right = abs(b.real) * abs(a.budget);
    if (left !== right) return left > right ? -1 : 1;
  }
  return byName(a, b);
}

/** Liste unique de l'écran Budgets : dépenses et épargne par consommation, puis revenus, puis virements. */
export function sortBudgetLines(breakdown: BudgetBreakdownResponse): BudgetCategoryBreakdown[] {
  return sortBudgetRows(breakdown).map((row) => row.line);
}

export interface BudgetRow {
  line: BudgetCategoryBreakdown;
  /** Revenu ou virement : un restant négatif y est un surplus, pas un dépassement. */
  isIncome: boolean;
  /** Catégorie de revenu (affichée dans la section « Revenus ») ; false pour un virement. */
  isRevenue: boolean;
}

export function sortBudgetRows(breakdown: BudgetBreakdownResponse): BudgetRow[] {
  const spending = [...breakdown.expenses, ...breakdown.savings].sort(compareConsumption);
  return [
    ...spending.map((line) => ({ line, isIncome: false, isRevenue: false })),
    ...[...breakdown.income].sort(byName).map((line) => ({ line, isIncome: true, isRevenue: true })),
    ...[...breakdown.transfers].sort(byName).map((line) => ({ line, isIncome: true, isRevenue: false })),
  ];
}
