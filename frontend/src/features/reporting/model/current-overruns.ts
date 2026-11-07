import { BudgetBreakdownResponse, BudgetCategoryBreakdown } from './types';

export interface CurrentOverrun {
  categoryId: string;
  name: string;
  /** Centimes (chaîne, positif) au-delà du budget : l'opposé du « restant » de la répartition. */
  amount: string;
}

/**
 * Dépassement d'une ligne de la répartition : l'opposé d'un restant négatif, sinon 0 (centimes).
 * Seul calcul du dépassement en cours, partagé par À traiter et le bloc Budgets.
 */
export function overrunAmount(item: BudgetCategoryBreakdown): bigint {
  const remaining = BigInt(item.remaining);
  return remaining < BigInt(0) ? -remaining : BigInt(0);
}

/**
 * Dépassements de la période en cours : catégories de dépense et d'épargne dont le restant de la
 * répartition du budget est négatif (factures `pending` comprises). Même chiffre que le bloc Budgets.
 */
export function currentOverruns(breakdown: BudgetBreakdownResponse | undefined): CurrentOverrun[] {
  if (!breakdown) return [];
  return [...breakdown.expenses, ...breakdown.savings]
    .filter((item) => overrunAmount(item) > BigInt(0))
    .map((item) => ({
      categoryId: item.categoryId,
      name: item.name,
      amount: overrunAmount(item).toString(),
    }));
}
