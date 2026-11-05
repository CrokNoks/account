import { Injectable } from '@nestjs/common';
import { CategoryRepository } from '../../categories/domain/category.repository.interface';
import { TransactionRepository } from '../../transactions/domain/transaction.repository.interface';
import { BudgetRepository } from '../../budgets/domain/budget.repository.interface';
import { PeriodRepository } from '../../periods/domain/period.repository.interface';
import { CategoryType } from '../../categories/domain/category.entity';
import { ensureBelongsToAccount } from '../../shared/domain/account-ownership';
import { roundedPercentage } from '../../shared/domain/percentage';

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
    const period = ensureBelongsToAccount(
      await this.periodRepository.findById(periodId),
      accountId,
      'Period',
    );

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

      // Le budget est enregistré avec l'un ou l'autre signe (les dépenses sont
      // parfois en négatif) : on compare toujours à sa valeur absolue.
      const limit = budget < BigInt(0) ? -budget : budget;
      // Dépenses et épargne : réel négatif => |budget| + réel.
      // Revenus et virements (comptés comme des revenus, cf. docs/reporting.md) :
      // réel positif => reste à percevoir = |budget| - réel.
      const remaining =
        cat.type === CategoryType.INCOME || cat.type === CategoryType.TRANSFER
          ? limit - real
          : limit + real;
      let percentage = 0;
      if (limit !== BigInt(0)) {
        percentage = roundedPercentage(real, limit);
        if (cat.type === CategoryType.EXPENSE) percentage = 0 - percentage; // invert for expenses
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
