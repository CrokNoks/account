import { BudgetBreakdownResponse } from './types';

export interface CurrentOverrun {
  categoryId: string;
  name: string;
  /** Centimes (chaîne, positif) au-delà du budget : l'opposé du « restant » de la répartition. */
  amount: string;
}

/**
 * Dépassements de la période en cours : catégories de dépense et d'épargne dont le restant de la
 * répartition du budget est négatif (factures `pending` comprises). Même chiffre que le bloc Budgets.
 */
export function currentOverruns(breakdown: BudgetBreakdownResponse | undefined): CurrentOverrun[] {
  if (!breakdown) return [];
  return [...breakdown.expenses, ...breakdown.savings]
    .filter((item) => parseInt(item.remaining, 10) < 0)
    .map((item) => ({
      categoryId: item.categoryId,
      name: item.name,
      amount: String(-parseInt(item.remaining, 10)),
    }));
}
