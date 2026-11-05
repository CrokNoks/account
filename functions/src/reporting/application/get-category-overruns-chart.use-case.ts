import { Injectable, Logger } from '@nestjs/common';
import { CategoryRepository } from '../../categories/domain/category.repository.interface';
import { CategoryType } from '../../categories/domain/category.entity';
import { TransactionRepository } from '../../transactions/domain/transaction.repository.interface';
import { BudgetRepository } from '../../budgets/domain/budget.repository.interface';
import { PeriodRepository } from '../../periods/domain/period.repository.interface';
import { ensureBelongsToAccount } from '../../shared/domain/account-ownership';
import {
  DomainValidationError,
  NotFoundError,
} from '../../shared/domain/errors';
import { closedPeriods, loadPeriodOverruns } from './period-overruns';

export interface CategoryOverrunChartPoint {
  periodId: string;
  startDate: string;
  endDate: string;
  budget: string;
  overrun: string;
}

export interface CategoryOverrunsChartResponse {
  categoryId: string;
  points: CategoryOverrunChartPoint[];
}

@Injectable()
export class GetCategoryOverrunsChartUseCase {
  private readonly logger = new Logger(GetCategoryOverrunsChartUseCase.name);

  constructor(
    private readonly categoryRepository: CategoryRepository,
    private readonly transactionRepository: TransactionRepository,
    private readonly budgetRepository: BudgetRepository,
    private readonly periodRepository: PeriodRepository,
  ) {}

  async execute(
    accountId: string,
    categoryId: string,
    startPeriodId: string,
    endPeriodId: string,
  ): Promise<CategoryOverrunsChartResponse> {
    const first = ensureBelongsToAccount(
      await this.periodRepository.findById(startPeriodId),
      accountId,
      'Period',
    );
    const last = ensureBelongsToAccount(
      await this.periodRepository.findById(endPeriodId),
      accountId,
      'Period',
    );
    if (first.isActive || last.isActive) {
      throw new DomainValidationError('Periods must be closed');
    }
    if (first.startDate.getTime() > last.startDate.getTime()) {
      throw new DomainValidationError(
        'Start period must not be after end period',
      );
    }

    const categories =
      await this.categoryRepository.findAllByAccount(accountId);
    const category = categories.find((c) => c.id === categoryId);
    if (!category) throw new NotFoundError('Category not found');
    if (
      category.type !== CategoryType.EXPENSE &&
      category.type !== CategoryType.SAVINGS
    ) {
      throw new DomainValidationError(
        'Category must be an expense or savings category',
      );
    }

    const periods = closedPeriods(
      await this.periodRepository.findAllByAccount(accountId),
    )
      .filter(
        (p) =>
          p.startDate.getTime() >= first.startDate.getTime() &&
          p.startDate.getTime() <= last.startDate.getTime(),
      )
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

    const points: CategoryOverrunChartPoint[] = [];
    for (const period of periods) {
      const entries = await loadPeriodOverruns(
        this.transactionRepository,
        this.budgetRepository,
        accountId,
        period,
        categories,
      );
      const entry = entries.find((e) => e.categoryId === categoryId);
      points.push({
        periodId: period.id,
        startDate: period.startDate.toISOString(),
        endDate: (period.endDate ?? period.startDate).toISOString(),
        budget: (entry?.budget ?? 0n).toString(),
        overrun: (entry?.overrun ?? 0n).toString(),
      });
    }

    this.logger.log({
      event: 'overruns_chart_built',
      accountId,
      categoryId,
      startPeriodId,
      endPeriodId,
      periodCount: points.length,
    });
    return { categoryId, points };
  }
}
