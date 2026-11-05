import { Injectable, Logger } from '@nestjs/common';
import { PeriodRepository } from '../domain/period.repository.interface';
import { BudgetRepository } from '../../budgets/domain/budget.repository.interface';
import { CategoryRepository } from '../../categories/domain/category.repository.interface';
import { proposedAmountForPeriod } from '../../budgets/domain/proposed-amount';
import {
  addDaysDateOnly,
  addMonthsDateOnly,
  todayDateOnly,
} from '../../shared/domain/date-only';

export interface PeriodDraft {
  suggestedStartDate: Date;
  suggestedEndDate: Date;
  categoriesWithStats: Array<{
    categoryId: string;
    name: string;
    minReal: string;
    maxReal: string;
    avgReal: string;
    defaultAllocated: string;
  }>;
}

@Injectable()
export class GetPeriodDraftUseCase {
  constructor(
    private readonly periodRepository: PeriodRepository,
    private readonly budgetRepository: BudgetRepository,
    private readonly categoryRepository: CategoryRepository,
  ) {}

  private readonly logger = new Logger(GetPeriodDraftUseCase.name);

  async execute(accountId: string): Promise<PeriodDraft> {
    // 1. Suggested dates
    const lastPeriod = await this.periodRepository.findLastByAccount(accountId);
    let startDate = todayDateOnly();
    if (lastPeriod) {
      startDate = addDaysDateOnly(
        lastPeriod.endDate || lastPeriod.startDate,
        1,
      );
    }
    // Un mois plus tard moins un jour (ex. 01/01 au 31/01 plutôt que 01/02)
    const endDate = addDaysDateOnly(addMonthsDateOnly(startDate, 1), -1);

    // 2. Historical stats
    const stats =
      await this.budgetRepository.getHistoricalStatsByAccount(accountId);

    // 3. Get all categories to match names
    const categories =
      await this.categoryRepository.findAllByAccount(accountId);

    // 4. Montants fixes configurés pour le compte (le montant proposé ne vient que d'eux)
    const templates =
      await this.budgetRepository.findTemplatesByAccount(accountId);
    const configured = new Map(templates.map((t) => [t.categoryId, t.amount]));

    const categoriesWithStats = categories.map((cat) => {
      const catStat = stats.find((s) => s.categoryId === cat.id);
      const min = catStat?.minReal || BigInt(0);
      const max = catStat?.maxReal || BigInt(0);
      const avg = catStat?.avgReal || BigInt(0);
      const defaultAllocated = proposedAmountForPeriod(configured.get(cat.id));

      return {
        categoryId: cat.id,
        name: cat.name,
        minReal: min.toString(),
        maxReal: max.toString(),
        avgReal: avg.toString(),
        defaultAllocated: defaultAllocated.toString(),
      };
    });

    this.logger.log({
      event: 'period_draft_built',
      accountId,
      categories: categories.length,
      configuredNonZero: categoriesWithStats.filter(
        (c) => c.defaultAllocated !== '0',
      ).length,
    });

    return {
      suggestedStartDate: startDate,
      suggestedEndDate: endDate,
      categoriesWithStats,
    };
  }
}
