import { Injectable } from '@nestjs/common';
import { TransactionRepository } from '../../transactions/domain/transaction.repository.interface';
import { RecurringTransactionRepository } from '../../recurring/domain/recurring-transaction.repository.interface';
import {
  addDaysDateOnly,
  endOfMonthDateOnly,
  eachDayDateOnly,
  dateOnly,
  todayDateOnly,
} from '../../shared/domain/date-only';
import {
  isRecurringDueOn,
  recurringOccurrences,
} from '../../shared/domain/recurring-day';
import { EQUIVALENT_DAYS } from '../../shared/domain/recurring-equivalence';
import {
  readDueDate,
  readRecurringId,
} from '../../shared/domain/recurring-due-date';
import {
  occurrenceKey,
  settleOccurrences,
} from '../domain/recurring-already-paid';

/** Jours de transactions lus autour du mois pour reconnaître une échéance réglée (lien exact). */
const TRANSACTIONS_MARGIN_DAYS = 31;

export interface CalendarEvent {
  id: string;
  date: string;
  description: string;
  amount: string;
  type: 'actual' | 'recurring';
  categoryId: string | null;
  /** Facture en attente (toujours faux pour une récurrence projetée). */
  pending: boolean;
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

    // 1. Transactions du mois (affichées) + marge pour reconnaître les échéances réglées
    //    (jamais affichées : seulement appariées).
    const readTransactions =
      await this.transactionRepository.findAllByAccountUnpaginated(accountId, {
        startDate: addDaysDateOnly(startDate, -TRANSACTIONS_MARGIN_DAYS),
        endDate: addDaysDateOnly(endDate, TRANSACTIONS_MARGIN_DAYS),
      });
    const actualTransactions = readTransactions.filter(
      (t) => t.date >= startDate && t.date <= endDate,
    );

    const events: CalendarEvent[] = actualTransactions.map((t) => ({
      id: t.id,
      date: t.date.toISOString(),
      description: t.description,
      amount: t.amount.toString(),
      type: 'actual',
      categoryId: t.categoryId,
      pending: t.pending,
    }));

    // 2. Project recurring transactions for future days in the same month
    const recurringTxs =
      await this.recurringRepository.findAllByAccount(accountId);

    // Occurrences du mois débordant de 7 jours : une transaction ne règle qu'une occurrence,
    // y compris une voisine hors du mois. Réglée, quelle que soit la date de la transaction
    // (mois voisin compris), une occurrence n'est pas affichée en « Prévue ».
    const occurrences = recurringTxs.flatMap((rt) =>
      recurringOccurrences(
        rt.dayOfMonth,
        addDaysDateOnly(startDate, -EQUIVALENT_DAYS),
        addDaysDateOnly(endDate, EQUIVALENT_DAYS),
      ).map((date) => ({
        recurringId: rt.id,
        categoryId: rt.categoryId,
        description: rt.description,
        amount: rt.amount,
        date,
      })),
    );
    const settled = settleOccurrences(
      occurrences,
      readTransactions.map((t) => ({
        id: t.id,
        date: t.date,
        categoryId: t.categoryId,
        description: t.description,
        amount: t.amount,
        recurringId: readRecurringId(t.metadata),
        dueDate: readDueDate(t.metadata),
      })),
      new Set(recurringTxs.map((rt) => rt.id)),
    );

    const daysInMonth = eachDayDateOnly(startDate, endDate);

    for (const day of daysInMonth) {
      // Only project if it's today or in the future
      if (day >= today) {
        const matches = recurringTxs.filter((rt) =>
          isRecurringDueOn(rt.dayOfMonth, day),
        );

        for (const match of matches) {
          if (settled.has(occurrenceKey(match.id, day))) continue;
          events.push({
            id: `projected-${match.id}-${day.toISOString()}`,
            date: day.toISOString(),
            description: match.description,
            amount: match.amount.toString(),
            type: 'recurring',
            categoryId: match.categoryId,
            pending: false,
          });
        }
      }
    }

    return events.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
  }
}
