import { sortBudgetRows } from '@/features/budgets/model/sort-budget-lines';
import { spentAmount } from '../lib/budget-surplus';
import type { BudgetCategoryBreakdown, BudgetBreakdownResponse } from './types';

export const BUDGETS_TO_WATCH_LIMIT = 5;

/**
 * « Budgets à surveiller » de l'accueil mobile : dépenses et épargne dans l'ordre existant de
 * `sortBudgetRows` (dépassés en tête, puis % consommé), 5 au plus. Une ligne sans budget ni consommé (remboursement compris) est omise.
 */
export function budgetsToWatch(breakdown: BudgetBreakdownResponse | undefined | null): BudgetCategoryBreakdown[] {
  if (!breakdown) return [];
  return sortBudgetRows(breakdown)
    .filter((row) => !row.isIncome)
    .map((row) => row.line)
    .filter((line) => BigInt(line.budget) !== BigInt(0) || spentAmount(BigInt(line.real)) !== BigInt(0))
    .slice(0, BUDGETS_TO_WATCH_LIMIT);
}
