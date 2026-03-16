import { Injectable } from '@nestjs/common';
import { AccountRepository } from '../../accounts/domain/account.repository.interface';
import { PeriodRepository } from '../../periods/domain/period.repository.interface';
import { TransactionRepository } from '../../transactions/domain/transaction.repository.interface';
import { CategoryRepository } from '../../categories/domain/category.repository.interface';
import { CategoryType } from '../../categories/domain/category.entity';

export interface EvolutionDataPoint {
  periodId: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  realIncome: string;
  realExpenses: string;
  forecastBalance: string;
  realBankBalance: string;
  categories: Record<string, string>;
}

@Injectable()
export class GetEvolutionUseCase {
  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly periodRepository: PeriodRepository,
    private readonly transactionRepository: TransactionRepository,
    private readonly categoryRepository: CategoryRepository,
  ) {}

  async execute(
    accountId: string,
    onlyClosed: boolean = false,
  ): Promise<EvolutionDataPoint[]> {
    const account = await this.accountRepository.findById(accountId);
    if (!account) throw new Error('Account not found');

    let periods = await this.periodRepository.findAllByAccount(accountId);

    if (onlyClosed) {
      periods = periods.filter((p) => !p.isActive);
    }

    // Sort periods chronologically
    periods.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

    const categories =
      await this.categoryRepository.findAllByAccount(accountId);
    const result: EvolutionDataPoint[] = [];

    // Pre-fetch all transactions to avoid N+1 queries if there are many periods
    const allTransactions =
      await this.transactionRepository.findAllByAccount(accountId);

    for (const period of periods) {
      // 1. Start Balance calculation (Initial + transactions before start date)
      const transactionsBeforeStart = allTransactions.filter(
        (t) => t.date < period.startDate,
      );
      const sumBeforeStart = transactionsBeforeStart.reduce(
        (sum, t) => sum + t.amount,
        BigInt(0),
      );
      const startBalance = account.initialBalance + sumBeforeStart;

      // 2. Period Transactions
      const periodTransactions = allTransactions.filter(
        (t) => t.date >= period.startDate && (!period.endDate || t.date <= period.endDate),
      );

      const realByCategory = new Map<string, bigint>();
      for (const t of periodTransactions) {
        if (t.categoryId) {
          const current = realByCategory.get(t.categoryId) || BigInt(0);
          realByCategory.set(t.categoryId, current + t.amount);
        }
      }

      let realIncome = BigInt(0);
      let realExpenses = BigInt(0);
      const categoriesJson: Record<string, string> = {};

      for (const cat of categories) {
        const catReal = realByCategory.get(cat.id) || BigInt(0);
        const isIncome =
          cat.type === CategoryType.INCOME ||
          cat.type === CategoryType.TRANSFER;

        if (isIncome) {
          realIncome += catReal;
        } else {
          realExpenses += catReal;
        }

        categoriesJson[cat.id] = catReal.toString();
      }

      // 3. Balances
      const reconciledInPeriod = periodTransactions
        .filter((t) => t.reconciled)
        .reduce((sum, t) => sum + t.amount, BigInt(0));
      const realBankBalance = startBalance + reconciledInPeriod;

      const allInPeriod = periodTransactions.reduce(
        (sum, t) => sum + t.amount,
        BigInt(0),
      );
      const forecastBalance = startBalance + allInPeriod;

      result.push({
        periodId: period.id,
        startDate: period.startDate.toISOString(),
        endDate: period.endDate ? period.endDate.toISOString() : '',
        isActive: period.isActive,
        realIncome: realIncome.toString(),
        realExpenses: realExpenses.toString(),
        forecastBalance: forecastBalance.toString(),
        realBankBalance: realBankBalance.toString(),
        categories: categoriesJson,
      });
    }

    return result;
  }
}
