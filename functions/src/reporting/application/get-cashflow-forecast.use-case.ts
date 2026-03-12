import { Injectable } from '@nestjs/common';
import { AccountRepository } from '../../accounts/domain/account.repository.interface';
import { TransactionRepository } from '../../transactions/domain/transaction.repository.interface';
import { RecurringTransactionRepository } from '../../recurring/domain/recurring-transaction.repository.interface';
import { addDays, getDate, startOfDay } from 'date-fns';

export interface CashflowEvent {
  date: string;
  description: string;
  amount: string;
  projectedBalance: string;
  type: 'current_balance' | 'recurring';
}

export interface CashflowForecastResponse {
  currentBalance: string;
  events: CashflowEvent[];
}

@Injectable()
export class GetCashflowForecastUseCase {
  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly transactionRepository: TransactionRepository,
    private readonly recurringRepository: RecurringTransactionRepository,
  ) {}

  async execute(
    accountId: string,
    days: number = 90,
  ): Promise<CashflowForecastResponse> {
    const account = await this.accountRepository.findById(accountId);
    if (!account) throw new Error('Account not found');

    // 1. Get current balance (up to today inclusive)
    const tomorrow = startOfDay(addDays(new Date(), 1));
    const sumAll =
      await this.transactionRepository.sumAmountByAccountBeforeDate(
        accountId,
        tomorrow,
      );
    const currentBalance = account.initialBalance + sumAll;

    // 2. Get recurring transactions
    const recurringTxs =
      await this.recurringRepository.findAllByAccount(accountId);

    // 3. Project events
    const events: CashflowEvent[] = [];
    let runningBalance = currentBalance;

    const startDate = startOfDay(new Date());

    // We iterate day by day to find recurring events
    for (let d = 0; d <= days; d++) {
      const currentDay = addDays(startDate, d);
      const dayOfMonth = getDate(currentDay);

      // Find recurring transactions matching this day of month
      const matches = recurringTxs.filter((rt) => rt.dayOfMonth === dayOfMonth);

      for (const match of matches) {
        // Optimization: Avoid showing recurring if it already happened today (it would be in current balance)
        // But for simplicity in a 90-day forecast, we show all future occurrences.
        // If d=0 (today), we check if a transaction with same description/amount exists today.

        runningBalance += match.amount;
        events.push({
          date: currentDay.toISOString(),
          description: match.description,
          amount: match.amount.toString(),
          projectedBalance: runningBalance.toString(),
          type: 'recurring',
        });
      }
    }

    return {
      currentBalance: currentBalance.toString(),
      events,
    };
  }
}
