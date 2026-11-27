import { Injectable } from '@nestjs/common';
import { CategoryRepository } from '../../categories/domain/category.repository.interface';
import { TransactionRepository } from '../../transactions/domain/transaction.repository.interface';
import { BudgetRepository } from '../../budgets/domain/budget.repository.interface';
import { PeriodRepository } from '../../periods/domain/period.repository.interface';
import { CategoryType } from '../../categories/domain/category.entity';
import { ensureBelongsToAccount } from '../../shared/domain/account-ownership';
import { roundedPercentage } from '../../shared/domain/percentage';
import { expenseRule } from '../domain/period-forecast';
import {
  filterPeriodWindow,
  periodLoadEndDate,
  toWindowPeriod,
} from '../domain/period-window';
import {
  transferDirection,
  type TransferDirection,
} from '../domain/transfer-direction';

export interface BudgetCategoryBreakdown {
  categoryId: string;
  name: string;
  real: string;
  budget: string;
  remaining: string;
  percentage: number;
  /** Sens, pour les catégories de type virement seulement (calculé ici, le front ne le recalcule pas). */
  direction?: TransferDirection;
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

    // Même fenêtre que le prévu (domain/period-window)
    const periodTransactions = filterPeriodWindow(
      await this.transactionRepository.findAllByAccountUnpaginated(accountId, {
        startDate: period.startDate,
        endDate: periodLoadEndDate(period),
      }),
      toWindowPeriod(period, categories),
    );

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
      // Un virement sortant se lit comme une dépense, un virement entrant comme un revenu.
      const direction =
        cat.type === CategoryType.TRANSFER
          ? transferDirection(budget, real)
          : undefined;
      const asExpense =
        cat.type === CategoryType.EXPENSE ||
        cat.type === CategoryType.SAVINGS ||
        direction === 'outgoing';
      // Dépenses, épargne, virements sortants : |budget| - dépensé (règle du prévu,
      // `expenseRule`) ; un remboursement (réel positif) ne dépasse pas |budget|.
      // Revenus et virements entrants : réel positif => reste à percevoir = |budget| - réel.
      const remaining = asExpense
        ? limit - expenseRule(real, budget).spent
        : limit - real;
      let percentage = 0;
      if (limit !== BigInt(0)) {
        percentage = roundedPercentage(real, limit);
        if (cat.type === CategoryType.EXPENSE || direction === 'outgoing')
          percentage = 0 - percentage; // invert for expenses
      }

      const item: BudgetCategoryBreakdown = {
        categoryId: cat.id,
        name: cat.name,
        real: real.toString(),
        budget: budget.toString(),
        remaining: remaining.toString(),
        percentage,
        ...(direction ? { direction } : {}),
      };

      if (cat.type === CategoryType.INCOME) result.income.push(item);
      else if (cat.type === CategoryType.EXPENSE) result.expenses.push(item);
      else if (cat.type === CategoryType.SAVINGS) result.savings.push(item);
      else if (cat.type === CategoryType.TRANSFER) result.transfers.push(item);
    }

    return result;
  }
}
