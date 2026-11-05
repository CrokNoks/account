import { Injectable, Logger } from '@nestjs/common';
import { CategoryRepository } from '../../categories/domain/category.repository.interface';
import { TransactionRepository } from '../../transactions/domain/transaction.repository.interface';
import { BudgetRepository } from '../../budgets/domain/budget.repository.interface';
import { PeriodRepository } from '../../periods/domain/period.repository.interface';
import { closedPeriods, loadPeriodOverruns } from './period-overruns';

export interface CategoryOverrunItem {
  categoryId: string;
  name: string;
  budget: string;
  real: string;
  overrun: string;
}

export interface PeriodOverruns {
  periodId: string;
  startDate: string;
  endDate: string;
  overruns: CategoryOverrunItem[];
}

export interface OverrunsByPeriodResponse {
  periods: PeriodOverruns[];
}

@Injectable()
export class GetOverrunsByPeriodUseCase {
  private readonly logger = new Logger(GetOverrunsByPeriodUseCase.name);

  constructor(
    private readonly categoryRepository: CategoryRepository,
    private readonly transactionRepository: TransactionRepository,
    private readonly budgetRepository: BudgetRepository,
    private readonly periodRepository: PeriodRepository,
  ) {}

  async execute(accountId: string): Promise<OverrunsByPeriodResponse> {
    const periods = closedPeriods(
      await this.periodRepository.findAllByAccount(accountId),
    ).sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
    const categories =
      await this.categoryRepository.findAllByAccount(accountId);
    const names = new Map(categories.map((c) => [c.id, c.name]));

    const result: PeriodOverruns[] = [];
    let overrunCount = 0;
    for (const period of periods) {
      const entries = await loadPeriodOverruns(
        this.transactionRepository,
        this.budgetRepository,
        accountId,
        period,
        categories,
      );
      const overruns = entries
        .filter((e) => e.overrun > 0n)
        .map((e) => ({
          categoryId: e.categoryId,
          name: names.get(e.categoryId) ?? '',
          budget: e.budget.toString(),
          real: e.real.toString(),
          overrun: e.overrun.toString(),
        }));
      overrunCount += overruns.length;
      result.push({
        periodId: period.id,
        startDate: period.startDate.toISOString(),
        endDate: (period.endDate ?? period.startDate).toISOString(),
        overruns,
      });
    }

    this.logger.log({
      event: 'overruns_report_built',
      accountId,
      periodCount: result.length,
      overrunCount,
    });
    return { periods: result };
  }
}
