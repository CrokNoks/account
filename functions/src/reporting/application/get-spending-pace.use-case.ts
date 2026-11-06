import { Injectable, Logger } from '@nestjs/common';
import { AccountRepository } from '../../accounts/domain/account.repository.interface';
import { PeriodRepository } from '../../periods/domain/period.repository.interface';
import { TransactionRepository } from '../../transactions/domain/transaction.repository.interface';
import { CategoryRepository } from '../../categories/domain/category.repository.interface';
import { Period } from '../../periods/domain/period.entity';
import { NotFoundError } from '../../shared/domain/errors';
import { addDaysDateOnly, todayDateOnly } from '../../shared/domain/date-only';
import { buildSpendingPace, PaceWindow } from '../domain/spending-pace';

export interface SpendingPacePoint {
  day: number;
  date: string;
  cumulative: string;
  previousCumulative: string | null;
}

export interface SpendingPaceResponse {
  points: SpendingPacePoint[];
  previousPeriodId: string | null;
  /** cumul courant - cumul de la précédente au même jour (centimes signés). */
  gap: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const daysBetween = (from: Date, to: Date): number =>
  Math.max(0, Math.round((to.getTime() - from.getTime()) / DAY_MS) + 1);
const earliest = (a: Date, b: Date): Date => (a < b ? a : b);

@Injectable()
export class GetSpendingPaceUseCase {
  private readonly logger = new Logger(GetSpendingPaceUseCase.name);

  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly periodRepository: PeriodRepository,
    private readonly transactionRepository: TransactionRepository,
    private readonly categoryRepository: CategoryRepository,
  ) {}

  async execute(
    accountId: string,
    periodId: string,
    today: Date = todayDateOnly(),
  ): Promise<SpendingPaceResponse> {
    const account = await this.accountRepository.findById(accountId);
    const period = await this.periodRepository.findById(periodId);
    if (!account || !period || period.accountId !== accountId)
      throw new NotFoundError('Account or Period not found');

    const [categories, allPeriods] = await Promise.all([
      this.categoryRepository.findAllByAccount(accountId),
      this.periodRepository.findAllByAccount(accountId),
    ]);
    const categoryTypes = new Map(categories.map((c) => [c.id, c.type]));

    // Période active ou sans fin : jusqu'à aujourd'hui ; fermée : sa fin.
    const last =
      period.isActive || !period.endDate
        ? earliest(period.endDate ?? today, today)
        : period.endDate;
    // Période future (non active comprise) : rien à tracer, la courbe n'a pas commencé.
    const days =
      period.startDate > today ? 0 : daysBetween(period.startDate, last);

    const previousPeriod = this.findPrevious(period, allPeriods);

    const transactions =
      days > 0
        ? await this.transactionRepository.findAllByAccountUnpaginated(
            accountId,
            { startDate: period.startDate, endDate: last },
          )
        : [];

    let previous: PaceWindow | null = null;
    if (previousPeriod) {
      const previousEnd = earliest(
        previousPeriod.endDate ?? addDaysDateOnly(period.startDate, -1),
        today,
      );
      const previousDays = daysBetween(previousPeriod.startDate, previousEnd);
      previous = {
        start: previousPeriod.startDate,
        days: previousDays,
        transactions:
          previousDays > 0
            ? await this.transactionRepository.findAllByAccountUnpaginated(
                accountId,
                { startDate: previousPeriod.startDate, endDate: previousEnd },
              )
            : [],
      };
    }

    const pace = buildSpendingPace({
      start: period.startDate,
      days,
      transactions,
      categoryTypes,
      previous,
    });

    this.logger.log({
      event: 'spending_pace_built',
      accountId,
      periodId,
      dayCount: days,
      hasPrevious: previousPeriod !== null,
    });

    return {
      points: pace.points.map((p) => ({
        day: p.day,
        date: p.date,
        cumulative: p.cumulative.toString(),
        previousCumulative: p.previousCumulative?.toString() ?? null,
      })),
      previousPeriodId: previousPeriod?.id ?? null,
      gap: pace.gap?.toString() ?? null,
    };
  }

  /** Période du compte dont le début est immédiatement antérieur. */
  private findPrevious(period: Period, all: Period[]): Period | null {
    let best: Period | null = null;
    for (const p of all) {
      if (p.startDate >= period.startDate) continue;
      if (!best || p.startDate > best.startDate) best = p;
    }
    return best;
  }
}
