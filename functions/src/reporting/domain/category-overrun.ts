import { CategoryType } from '../../categories/domain/category.entity';

export interface OverrunCategory {
  id: string;
  type: CategoryType;
}

export interface OverrunTransaction {
  categoryId: string | null;
  amount: bigint;
  pending: boolean;
}

export interface CategoryOverrun {
  categoryId: string;
  /** Valeur absolue, 0n si pas de budget. */
  budget: bigint;
  /** Somme signée hors pending. */
  real: bigint;
  /** >= 0n */
  overrun: bigint;
}

const abs = (n: bigint): bigint => (n < 0n ? -n : n);

const isTracked = (type: CategoryType): boolean =>
  type === CategoryType.EXPENSE || type === CategoryType.SAVINGS;

/**
 * Dépassement (centimes) d'une catégorie sur une période.
 * Priorité : type, budget 0, signe du réel, comparaison stricte.
 */
export function computeOverrun(
  type: CategoryType,
  budget: bigint,
  real: bigint,
): bigint {
  if (!isTracked(type)) return 0n;
  const limit = abs(budget);
  if (limit === 0n) return 0n;
  if (real >= 0n) return 0n; // remboursements nets : jamais de dépassement
  const excess = -real - limit;
  return excess > 0n ? excess : 0n;
}

/**
 * Une période. `transactions` sont déjà filtrées par dates de la période.
 * Une entrée par catégorie dépense/épargne, dans l'ordre de `categories`.
 */
export function computeOverrunsForPeriod(
  categories: OverrunCategory[],
  budgetByCategory: Map<string, bigint>,
  transactions: OverrunTransaction[],
): CategoryOverrun[] {
  const realByCategory = new Map<string, bigint>();
  for (const t of transactions) {
    if (t.categoryId === null || t.pending) continue;
    realByCategory.set(
      t.categoryId,
      (realByCategory.get(t.categoryId) ?? 0n) + t.amount,
    );
  }

  return categories
    .filter((c) => isTracked(c.type))
    .map((c) => {
      const budget = abs(budgetByCategory.get(c.id) ?? 0n);
      const real = realByCategory.get(c.id) ?? 0n;
      return {
        categoryId: c.id,
        budget,
        real,
        overrun: computeOverrun(c.type, budget, real),
      };
    });
}
