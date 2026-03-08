import { Injectable } from '@nestjs/common';
import { PeriodRepository } from '../domain/period.repository.interface';
import { Period } from '../domain/period.entity';
import { BudgetRepository } from '../../budgets/domain/budget.repository.interface';
import { BudgetInstance } from '../../budgets/domain/budget-instance.entity';

export interface CreatePeriodWithBudgetsCommand {
  accountId: string;
  startDate: Date;
  endDate: Date;
  budgets: Array<{
    categoryId: string;
    amountAllocated: bigint;
  }>;
}

@Injectable()
export class CreatePeriodWithBudgetsUseCase {
  constructor(
    private readonly periodRepository: PeriodRepository,
    private readonly budgetRepository: BudgetRepository,
  ) {}

  async execute(command: CreatePeriodWithBudgetsCommand): Promise<{ period: Period, budgets: BudgetInstance[] }> {
    // 1. Create Period
    const period = Period.create({
      accountId: command.accountId,
      startDate: command.startDate,
      endDate: command.endDate,
    });

    // 2. Create Budget Instances
    const budgetInstances = command.budgets.map(b => 
      BudgetInstance.create({
        periodId: period.id,
        categoryId: b.categoryId,
        amountAllocated: b.amountAllocated,
      })
    );

    // 3. Save everything
    await this.periodRepository.save(period);
    if (budgetInstances.length > 0) {
      await this.budgetRepository.saveBulk(budgetInstances);
    }

    return { period, budgets: budgetInstances };
  }
}
