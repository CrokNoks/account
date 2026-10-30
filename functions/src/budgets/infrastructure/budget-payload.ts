import { BudgetInstance } from '../domain/budget-instance.entity';

/**
 * Forme JSON d'un budget attendue par les fonctions SQL `create_period_with_budgets`
 * et `replace_period_budgets` (supabase/migrations).
 */
export function toBudgetPayload(instance: BudgetInstance) {
  return {
    id: instance.id,
    period_id: instance.periodId,
    category_id: instance.categoryId,
    amount_allocated: instance.amountAllocated.toString(),
    created_at: instance.createdAt.toISOString(),
    updated_at: instance.updatedAt.toISOString(),
  };
}
