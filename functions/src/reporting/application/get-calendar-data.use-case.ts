import { Injectable } from '@nestjs/common';
import { TransactionRepository } from '../../transactions/domain/transaction.repository.interface';
import { RecurringTransactionRepository } from '../../recurring/domain/recurring-transaction.repository.interface';
import {
  endOfMonthDateOnly,
  eachDayDateOnly,
  dateOnly,
  todayDateOnly,
} from '../../shared/domain/date-only';
import { isRecurringDueOn } from '../../shared/domain/recurring-day';

export interface CalendarEvent {
  id: string;
  date: string;
  description: string;
  amount: string;
  type: 'actual' | 'recurring';
  categoryId: string | null;
}

@Injectable()
export class GetCalendarDataUseCase {
  constructor(
    private readonly transactionRepository: TransactionRepository,
    private readonly recurringRepository: RecurringTransactionRepository,
  ) {}

  async execute(
    accountId: string,
    year: number,
    month: number, // 1-12
  ): Promise<CalendarEvent[]> {
    const startDate = dateOnly(year, month, 1);
    const endDate = endOfMonthDateOnly(startDate);
    const today = todayDateOnly();

    // 1. Fetch actual transactions for the interval
    const actualTransactions =
      await this.transactionRepository.findAllByAccountUnpaginated(accountId, {
        startDate,
        endDate,
      });

    const events: CalendarEvent[] = actualTransactions.map((t) => ({
      id: t.id,
      date: t.date.toISOString(),
      description: t.description,
      amount: t.amount.toString(),
      type: 'actual',
      categoryId: t.categoryId,
    }));

    // 2. Project recurring transactions for future days in the same month
    const recurringTxs =
      await this.recurringRepository.findAllByAccount(accountId);

    const daysInMonth = eachDayDateOnly(startDate, endDate);

    for (const day of daysInMonth) {
      // Only project if it's today or in the future
      if (day >= today) {
        const matches = recurringTxs.filter((rt) =>
          isRecurringDueOn(rt.dayOfMonth, day),
        );

        for (const match of matches) {
          // Check if an actual transaction already exists for this recurring transaction today
          // Simple heuristic: same description and same amount on the same day
          const alreadyPaid = actualTransactions.some(
            (at) =>
              at.date.getTime() === day.getTime() &&
              at.description
                .toLowerCase()
                .includes(match.description.toLowerCase()) &&
              at.amount === match.amount,
          );

          if (!alreadyPaid) {
            events.push({
              id: `projected-${match.id}-${day.toISOString()}`,
              date: day.toISOString(),
              description: match.description,
              amount: match.amount.toString(),
              type: 'recurring',
              categoryId: match.categoryId,
            });
          }
        }
      }
    }

    return events.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
  }
}
