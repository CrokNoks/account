import { Category } from '../../categories/domain/category.entity';
import { Period } from '../../periods/domain/period.entity';
import { BudgetRepository } from '../../budgets/domain/budget.repository.interface';
import { TransactionRepository } from '../../transactions/domain/transaction.repository.interface';
import {
  CategoryOverrun,
  computeOverrunsForPeriod,
} from '../domain/category-overrun';

/**
 * Chargement partagé par la liste et le graphique : transactions rattachées par
 * dates (bornes incluses, jamais par period_id), budgets propres à la période,
 * puis la fonction pure de calcul.
 */
export async function loadPeriodOverruns(
  transactionRepository: TransactionRepository,
  budgetRepository: BudgetRepository,
  accountId: string,
  period: Period,
  categories: Category[],
): Promise<CategoryOverrun[]> {
  const budgets = await budgetRepository.findAllByPeriod(period.id);
  const transactions = await transactionRepository.findAllByAccountUnpaginated(
    accountId,
    { startDate: period.startDate, endDate: period.endDate || undefined },
  );
  const budgetByCategory = new Map<string, bigint>(
    budgets.map((b) => [b.categoryId, b.amountAllocated]),
  );
  return computeOverrunsForPeriod(categories, budgetByCategory, transactions);
}

export const closedPeriods = (periods: Period[]): Period[] =>
  periods.filter((p) => !p.isActive);
