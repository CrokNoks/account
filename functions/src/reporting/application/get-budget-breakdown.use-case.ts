import { Injectable } from '@nestjs/common';
import { CategoryRepository } from '../../categories/domain/category.repository.interface';
import { TransactionRepository } from '../../transactions/domain/transaction.repository.interface';
import { BudgetRepository } from '../../budgets/domain/budget.repository.interface';
import { PeriodRepository } from '../../periods/domain/period.repository.interface';
import { CategoryType } from '../../categories/domain/category.entity';

export interface BudgetCategoryBreakdown {
  categoryId: string;
  name: string;
  real: string;
  budget: string;
  remaining: string;
  percentage: number;
}

export interface BudgetBreakdownResponse {
  income: BudgetCategoryBreakdown[];
  expenses: BudgetCategoryBreakdown[];
  savings: BudgetCategoryBreakdown[];
  transfers: BudgetCategoryBreakdown[];
}

@Injectable()
export class GetBudgetBreakdownUseCase {
  constructor(
    private readonly categoryRepository: CategoryRepository,
    private readonly transactionRepository: TransactionRepository,
    private readonly budgetRepository: BudgetRepository,
    private readonly periodRepository: PeriodRepository,
  ) {}

  async execute(
    accountId: string,
    periodId: string,
  ): Promise<BudgetBreakdownResponse> {
    const period = await this.periodRepository.findById(periodId);
    if (!period) throw new Error('Period not found');

    const categories =
      await this.categoryRepository.findAllByAccount(accountId);
    const budgets = await this.budgetRepository.findAllByPeriod(periodId);

    // Only fetch transactions for this period
    const periodTransactions =
      await this.transactionRepository.findAllByAccountUnpaginated(accountId, {
        startDate: period.startDate,
        endDate: period.endDate || undefined,
      });

    const realByCategory = new Map<string, bigint>();
    for (const t of periodTransactions) {
      if (t.categoryId) {
        const current = realByCategory.get(t.categoryId) || BigInt(0);
        realByCategory.set(t.categoryId, current + t.amount);
      }
    }

    const result: BudgetBreakdownResponse = {
      income: [],
      expenses: [],
      savings: [],
      transfers: [],
    };

    for (const cat of categories) {
      const real = realByCategory.get(cat.id) || BigInt(0);
      const budgetInstance = budgets.find((b) => b.categoryId === cat.id);
      const budget = budgetInstance?.amountAllocated || BigInt(0);

      const remaining = budget + real; // be careful with signs, expenses are negative
      let percentage = 0;
      if (budget !== BigInt(0)) {
        percentage = Math.round(Number((real * BigInt(100)) / budget));
        if (cat.type === CategoryType.EXPENSE) percentage = -percentage; // invert for expenses
      }

      const item: BudgetCategoryBreakdown = {
        categoryId: cat.id,
        name: cat.name,
        real: real.toString(),
        budget: budget.toString(),
        remaining: remaining.toString(),
        percentage,
      };

      if (cat.type === CategoryType.INCOME) result.income.push(item);
      else if (cat.type === CategoryType.EXPENSE) result.expenses.push(item);
      else if (cat.type === CategoryType.SAVINGS) result.savings.push(item);
      else if (cat.type === CategoryType.TRANSFER) result.transfers.push(item);
    }

    return result;
  }
}
