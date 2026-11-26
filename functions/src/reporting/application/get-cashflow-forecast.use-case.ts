import { Injectable, Logger } from '@nestjs/common';
import { AccountRepository } from '../../accounts/domain/account.repository.interface';
import { TransactionRepository } from '../../transactions/domain/transaction.repository.interface';
import { RecurringTransactionRepository } from '../../recurring/domain/recurring-transaction.repository.interface';
import { addDaysDateOnly, todayDateOnly } from '../../shared/domain/date-only';
import {
  isRecurringDueOn,
  recurringOccurrences,
} from '../../shared/domain/recurring-day';
import { EQUIVALENT_DAYS } from '../../shared/domain/recurring-equivalence';
import {
  readDueDate,
  readRecurringId,
} from '../../shared/domain/recurring-due-date';
import { NotFoundError } from '../../shared/domain/errors';
import {
  occurrenceKey,
  settleOccurrences,
} from '../domain/recurring-already-paid';
import { computeLowPoint } from '../domain/cashflow-low-point';

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
  /** Jour 0 de la courbe (aujourd'hui dans le fuseau métier), comme les dates des événements. */
  startDate: string;
  /** Plus bas solde de fin de journée de l'horizon (premier jour en cas d'égalité). */
  lowPoint: { date: string; balance: string };
}

/** Jours de transactions lus avant aujourd'hui pour reconnaître une échéance payée en avance. */
const TRANSACTIONS_LOOKBACK_DAYS = 31;

@Injectable()
export class GetCashflowForecastUseCase {
  private readonly logger = new Logger(GetCashflowForecastUseCase.name);

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
    if (!account) throw new NotFoundError('Account not found');

    // 1. Get current balance (up to today inclusive)
    const startDate = todayDateOnly();
    const tomorrow = addDaysDateOnly(startDate, 1);
    const sumAll =
      await this.transactionRepository.sumAmountByAccountBeforeDate(
        accountId,
        tomorrow,
      );
    const currentBalance = account.initialBalance + sumAll;

    // 2. Get recurring transactions
    const recurringTxs =
      await this.recurringRepository.findAllByAccount(accountId);

    // Transactions lues pour reconnaître les échéances réglées : 31 jours avant aujourd'hui
    // (une facture payée en avance, retrouvée par son lien) et 7 jours après l'horizon.
    const lastDay = addDaysDateOnly(startDate, days);
    const transactions =
      await this.transactionRepository.findAllByAccountUnpaginated(accountId, {
        startDate: addDaysDateOnly(startDate, -TRANSACTIONS_LOOKBACK_DAYS),
        endDate: addDaysDateOnly(lastDay, EQUIVALENT_DAYS),
      });
    // Occurrences débordant de 7 jours de chaque côté de l'horizon : une transaction
    // ne règle qu'une occurrence, y compris une voisine hors de la vue.
    const occurrences = recurringTxs.flatMap((rt) =>
      recurringOccurrences(
        rt.dayOfMonth,
        addDaysDateOnly(startDate, -EQUIVALENT_DAYS),
        addDaysDateOnly(lastDay, EQUIVALENT_DAYS),
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
      transactions.map((t) => ({
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
    let alreadyPaidCount = 0;

    // 3. Project events
    const events: CashflowEvent[] = [];
    let runningBalance = currentBalance;

    // We iterate day by day to find recurring events
    for (let d = 0; d <= days; d++) {
      const currentDay = addDaysDateOnly(startDate, d);

      // Récurrentes dues ce jour (le 31 tombe le dernier jour d'un mois plus court)
      const matches = recurringTxs.filter((rt) =>
        isRecurringDueOn(rt.dayOfMonth, currentDay),
      );

      for (const match of matches) {
        // Réglée par une transaction déjà dans le solde du jour (datée d'aujourd'hui ou avant) :
        // comptée une fois, dans le solde. Réglée par une transaction future : reste projetée.
        const by = settled.get(occurrenceKey(match.id, currentDay));
        if (by && by.txDate <= startDate) {
          alreadyPaidCount++;
          continue;
        }

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

    const lowPoint = computeLowPoint(
      startDate,
      currentBalance,
      events.map((e) => ({ date: e.date, amount: BigInt(e.amount) })),
    );

    this.logger.log({
      event: 'cashflow_forecast_built',
      accountId,
      days,
      recurringCount: recurringTxs.length,
      alreadyPaidCount,
    });

    return {
      currentBalance: currentBalance.toString(),
      events,
      startDate: startDate.toISOString(),
      lowPoint: {
        date: lowPoint.date,
        balance: lowPoint.balance.toString(),
      },
    };
  }
}
