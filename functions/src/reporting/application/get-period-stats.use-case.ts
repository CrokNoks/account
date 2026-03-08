import { Injectable } from '@nestjs/common';
import { AccountRepository } from '../../accounts/domain/account.repository.interface';
import { PeriodRepository } from '../../periods/domain/period.repository.interface';
import { TransactionRepository } from '../../transactions/domain/transaction.repository.interface';
import { BudgetRepository } from '../../budgets/domain/budget.repository.interface';
import { CategoryRepository } from '../../categories/domain/category.repository.interface';
import { CategoryType } from '../../categories/domain/category.entity';

export interface PeriodStatsResponse {
  startBalance: string;
  realIncome: string;
  plannedIncome: string;
  realExpenses: string;
  plannedExpenses: string;
  realBankBalance: string;
  upcomingBalance: string;
  forecastBalance: string;
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

  async execute(accountId: string, periodId: string): Promise<PeriodStatsResponse> {
    const account = await this.accountRepository.findById(accountId);
    const period = await this.periodRepository.findById(periodId);
    if (!account || !period) throw new Error('Account or Period not found');

    const categories = await this.categoryRepository.findAllByAccount(accountId);
    const transactions = await this.transactionRepository.findAllByAccount(accountId);
    const budgets = await this.budgetRepository.findAllByPeriod(periodId);

    // 1. Start Balance (Initial + transactions before start date)
    const transactionsBeforeStart = transactions.filter(t => t.date < period.startDate);
    const sumBeforeStart = transactionsBeforeStart.reduce((sum, t) => sum + t.amount, BigInt(0));
    const startBalance = account.initialBalance + sumBeforeStart;

    // 2. Period Transactions
    const periodTransactions = transactions.filter(t => t.date >= period.startDate && t.date <= period.endDate);
    
    // Categorize real sums by categoryId
    const realByCategory = new Map<string, bigint>();
    for (const t of periodTransactions) {
      if (t.categoryId) {
        const current = realByCategory.get(t.categoryId) || BigInt(0);
        realByCategory.set(t.categoryId, current + t.amount);
      }
    }

    // Totals Real
    let realIncome = BigInt(0);
    let realExpenses = BigInt(0);
    
    // Totals Planned
    let plannedIncome = BigInt(0);
    let plannedExpenses = BigInt(0);

    // Forecast Calculation
    let forecastDiff = BigInt(0);

    for (const cat of categories) {
      const catReal = realByCategory.get(cat.id) || BigInt(0);
      const budget = budgets.find(b => b.categoryId === cat.id);
      const catBudget = budget?.amountAllocated || BigInt(0);

      const isIncome = cat.type === CategoryType.INCOME || cat.type === CategoryType.TRANSFER;
      
      if (isIncome) {
        realIncome += catReal;
        plannedIncome += catBudget;
        // Forecast for income: Max(real, budget) - take the best or optimistic
        forecastDiff += catReal > catBudget ? catReal : catBudget;
      } else {
        realExpenses += catReal;
        plannedExpenses += catBudget;
        // Forecast for expenses: Min(real, budget) - take the worst (most negative)
        forecastDiff += catReal < catBudget ? catReal : catBudget;
      }
    }

    // 4. Real Bank Balance (Start + reconciled until period end)
    const reconciledTransactionsUntilEnd = transactions.filter(t => t.reconciled && t.date <= period.endDate);
    const realBankBalance = account.initialBalance + reconciledTransactionsUntilEnd.reduce((sum, t) => sum + t.amount, BigInt(0));

    // 5. Upcoming Balance (Start + all until period end)
    const allTransactionsUntilEnd = transactions.filter(t => t.date <= period.endDate);
    const upcomingBalance = account.initialBalance + allTransactionsUntilEnd.reduce((sum, t) => sum + t.amount, BigInt(0));

    // 6. Forecast Balance (if active)
    const forecastBalance = startBalance + forecastDiff;

    return {
       startBalance: startBalance.toString(),
       realIncome: realIncome.toString(),
       plannedIncome: plannedIncome.toString(),
       realExpenses: realExpenses.toString(),
       plannedExpenses: plannedExpenses.toString(),
       realBankBalance: realBankBalance.toString(),
       upcomingBalance: upcomingBalance.toString(),
       forecastBalance: forecastBalance.toString()
    };
  }
}
