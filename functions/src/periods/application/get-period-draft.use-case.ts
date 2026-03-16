import { Injectable } from '@nestjs/common';
import { PeriodRepository } from '../domain/period.repository.interface';
import { BudgetRepository } from '../../budgets/domain/budget.repository.interface';
import { CategoryRepository } from '../../categories/domain/category.repository.interface';
import { RecurringTransactionRepository } from '../../recurring/domain/recurring-transaction.repository.interface';

export interface PeriodDraft {
  suggestedStartDate: Date;
  suggestedEndDate: Date;
  categoriesWithStats: Array<{
    categoryId: string;
    name: string;
    minReal: string;
    maxReal: string;
    avgReal: string;
    defaultAllocated: string;
  }>;
}

@Injectable()
export class GetPeriodDraftUseCase {
  constructor(
    private readonly periodRepository: PeriodRepository,
    private readonly budgetRepository: BudgetRepository,
    private readonly categoryRepository: CategoryRepository,
    private readonly recurringRepository: RecurringTransactionRepository,
  ) {}

  async execute(accountId: string): Promise<PeriodDraft> {
    // 1. Suggested dates
    const lastPeriod = await this.periodRepository.findLastByAccount(accountId);
    let startDate = new Date();
    if (lastPeriod) {
      startDate = new Date(lastPeriod.endDate || lastPeriod.startDate);
      startDate.setDate(startDate.getDate() + 1);
    }
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);
    // Move back one day to keep it consistent (e.g. 01/01 to 31/01 instead of 01/02)
    endDate.setDate(endDate.getDate() - 1);

    // 2. Historical stats
    const stats =
      await this.budgetRepository.getHistoricalStatsByAccount(accountId);

    // 3. Get all categories to match names
    const categories =
      await this.categoryRepository.findAllByAccount(accountId);

    // 4. Get recurring transactions to predict initial amounts
    const recurringTransactions =
      await this.recurringRepository.findAllByAccount(accountId);

    const categoriesWithStats = categories.map((cat) => {
      const catStat = stats.find((s) => s.categoryId === cat.id);
      const min = catStat?.minReal || BigInt(0);
      const max = catStat?.maxReal || BigInt(0);
      const avg = catStat?.avgReal || BigInt(0);

      const categoryRecurringTxs = recurringTransactions.filter(
        (rt) => rt.categoryId === cat.id,
      );

      let defaultAllocated = avg;
      if (categoryRecurringTxs.length > 0) {
        defaultAllocated = categoryRecurringTxs.reduce(
          (sum, rt) => sum + rt.amount,
          BigInt(0),
        );
      }

      return {
        categoryId: cat.id,
        name: cat.name,
        minReal: min.toString(),
        maxReal: max.toString(),
        avgReal: avg.toString(),
        defaultAllocated: defaultAllocated.toString(),
      };
    });

    return {
      suggestedStartDate: startDate,
      suggestedEndDate: endDate,
      categoriesWithStats,
    };
  }
}
