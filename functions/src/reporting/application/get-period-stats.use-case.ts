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
    const budgets = await this.budgetRepository.findAllByPeriod(periodId);

    // 1. Start Balance (Initial + transactions before start date calculated in DB)
    const sumBeforeStart = await this.transactionRepository.sumAmountByAccountBeforeDate(accountId, period.startDate);
    const startBalance = account.initialBalance + sumBeforeStart;

    // 2. Period Transactions (Only fetch what's needed)
    const periodTransactions = await this.transactionRepository.findAllByAccount(accountId, {
      startDate: period.startDate,
      endDate: period.endDate
    });
    
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

    for (const cat of categories) {
      const catReal = realByCategory.get(cat.id) || BigInt(0);
      const budget = budgets.find(b => b.categoryId === cat.id);
      const catBudget = budget?.amountAllocated || BigInt(0);

      const isIncome = cat.type === CategoryType.INCOME || cat.type === CategoryType.TRANSFER;
      
      if (isIncome) {
        realIncome += catReal;
        plannedIncome += catBudget;
      } else {
        realExpenses += catReal;
        plannedExpenses += catBudget;
      }
    }

    // 4. Real Bank Balance (Start + reconciled in this period)
    const reconciledInPeriod = periodTransactions.filter(t => t.reconciled).reduce((sum, t) => sum + t.amount, BigInt(0));
    const realBankBalance = startBalance + reconciledInPeriod;

    // 5. Upcoming Balance (Start + all in this period)
    const allInPeriod = periodTransactions.reduce((sum, t) => sum + t.amount, BigInt(0));
    const upcomingBalance = startBalance + allInPeriod;

    // 6. Forecast Balance
    // Formula: startBalance + max(realIncome, plannedIncome) - max(abs(realExpenses), abs(plannedExpenses))
    const absRealExpenses = realExpenses < BigInt(0) ? -realExpenses : realExpenses;
    const absPlannedExpenses = plannedExpenses < BigInt(0) ? -plannedExpenses : plannedExpenses;
    
    const maxIncome = realIncome > plannedIncome ? realIncome : plannedIncome;
    const maxAbsExpenses = absRealExpenses > absPlannedExpenses ? absRealExpenses : absPlannedExpenses;
    
    const forecastBalance = startBalance + maxIncome - maxAbsExpenses;

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
