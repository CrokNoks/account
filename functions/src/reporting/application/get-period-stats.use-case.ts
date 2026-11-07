import { Injectable } from '@nestjs/common';
import { AccountRepository } from '../../accounts/domain/account.repository.interface';
import { PeriodRepository } from '../../periods/domain/period.repository.interface';
import { TransactionRepository } from '../../transactions/domain/transaction.repository.interface';
import { BudgetRepository } from '../../budgets/domain/budget.repository.interface';
import { CategoryRepository } from '../../categories/domain/category.repository.interface';
import { computeForecastComposition } from '../domain/forecast-composition';
import { computePeriodForecast } from '../domain/period-forecast';
import { loadPeriodForecastInput } from './load-period-forecast-input';

export interface PeriodStatsResponse {
  startBalance: string;
  realIncome: string;
  plannedIncome: string;
  realExpenses: string;
  plannedExpenses: string;
  realBankBalance: string;
  upcomingBalance: string;
  forecastBalance: string;
  /** Composition du prévu (écran Aujourd'hui), lignes signées en centimes. */
  cardTotal: string;
  cardCount: number;
  billsTotal: string;
  budgetRemaining: string;
  expectedIncome: string;
}

@Injectable()
export class GetPeriodStatsUseCase {
  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly periodRepository: PeriodRepository,
    private readonly transactionRepository: TransactionRepository,
    private readonly budgetRepository: BudgetRepository,
    private readonly categoryRepository: CategoryRepository,
  ) {}

  async execute(
    accountId: string,
    periodId: string,
  ): Promise<PeriodStatsResponse> {
    const {
      categories,
      startBalance,
      periodTransactions,
      realByCategory,
      uncategorized,
    } = await loadPeriodForecastInput(
      {
        accountRepository: this.accountRepository,
        periodRepository: this.periodRepository,
        transactionRepository: this.transactionRepository,
        categoryRepository: this.categoryRepository,
      },
      accountId,
      periodId,
    );
    const budgets = await this.budgetRepository.findAllByPeriod(periodId);

    const {
      realIncome,
      plannedIncome,
      realExpenses,
      plannedExpenses,
      forecastBalance,
    } = computePeriodForecast({
      startBalance,
      categories,
      realByCategory,
      uncategorized,
      budgets: budgets.map((b) => ({
        categoryId: b.categoryId,
        amount: b.amountAllocated,
      })),
    });

    // 4. Real Bank Balance (Start + reconciled in this period)
    const reconciledInPeriod = periodTransactions
      .filter((t) => t.reconciled)
      .reduce((sum, t) => sum + t.amount, BigInt(0));
    const realBankBalance = startBalance + reconciledInPeriod;

    // 5. Upcoming Balance (Start + all NOT pending in this period)
    const nonPendingInPeriod = periodTransactions
      .filter((t) => !t.pending)
      .reduce((sum, t) => sum + t.amount, BigInt(0));
    const upcomingBalance = startBalance + nonPendingInPeriod;

    const composition = computeForecastComposition({
      transactions: periodTransactions,
      realIncome,
      plannedIncome,
      realExpenses,
      plannedExpenses,
    });

    return {
      startBalance: startBalance.toString(),
      realIncome: realIncome.toString(),
      plannedIncome: plannedIncome.toString(),
      realExpenses: realExpenses.toString(),
      plannedExpenses: plannedExpenses.toString(),
      realBankBalance: realBankBalance.toString(),
      upcomingBalance: upcomingBalance.toString(),
      forecastBalance: forecastBalance.toString(),
      cardTotal: composition.cardTotal.toString(),
      cardCount: composition.cardCount,
      billsTotal: composition.billsTotal.toString(),
      budgetRemaining: composition.budgetRemaining.toString(),
      expectedIncome: composition.expectedIncome.toString(),
    };
  }
}
