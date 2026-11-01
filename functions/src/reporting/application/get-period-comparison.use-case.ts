import { Injectable } from '@nestjs/common';
import {
  GetBudgetBreakdownUseCase,
  BudgetCategoryBreakdown,
} from './get-budget-breakdown.use-case';
import { roundedPercentage } from '../../shared/domain/percentage';

export interface ComparisonPoint {
  categoryId: string;
  name: string;
  period1Real: string;
  period2Real: string;
  diff: string;
  percentageDiff: number;
}

export interface PeriodComparisonResponse {
  income: ComparisonPoint[];
  expenses: ComparisonPoint[];
  savings: ComparisonPoint[];
  transfers: ComparisonPoint[];
}

@Injectable()
export class GetPeriodComparisonUseCase {
  constructor(
    private readonly getBudgetBreakdownUseCase: GetBudgetBreakdownUseCase,
  ) {}

  async execute(
    accountId: string,
    periodId1: string,
    periodId2: string,
  ): Promise<PeriodComparisonResponse> {
    const stats1 = await this.getBudgetBreakdownUseCase.execute(
      accountId,
      periodId1,
    );
    const stats2 = await this.getBudgetBreakdownUseCase.execute(
      accountId,
      periodId2,
    );

    return {
      income: this.compareGroups(stats1.income, stats2.income),
      expenses: this.compareGroups(stats1.expenses, stats2.expenses),
      savings: this.compareGroups(stats1.savings, stats2.savings),
      transfers: this.compareGroups(stats1.transfers, stats2.transfers),
    };
  }

  private compareGroups(
    group1: BudgetCategoryBreakdown[],
    group2: BudgetCategoryBreakdown[],
  ): ComparisonPoint[] {
    const allIds = Array.from(
      new Set([
        ...group1.map((c) => c.categoryId),
        ...group2.map((c) => c.categoryId),
      ]),
    );

    return allIds.map((id) => {
      const c1 = group1.find((c) => c.categoryId === id);
      const c2 = group2.find((c) => c.categoryId === id);

      const r1 = BigInt(c1?.real || '0');
      const r2 = BigInt(c2?.real || '0');
      const diff = r2 - r1;

      // Change of the amount (expenses are negative): -450 € → -300 € is -33.33 %.
      const abs1 = r1 < BigInt(0) ? -r1 : r1;
      const abs2 = r2 < BigInt(0) ? -r2 : r2;
      const percentageDiff = roundedPercentage(abs2 - abs1, abs1, 2);

      return {
        categoryId: id,
        name: c1?.name || c2?.name || 'Unknown',
        period1Real: r1.toString(),
        period2Real: r2.toString(),
        diff: diff.toString(),
        percentageDiff,
      };
    });
  }
}
