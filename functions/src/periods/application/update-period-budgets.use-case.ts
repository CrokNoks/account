import { Injectable } from '@nestjs/common';
import { BudgetRepository } from '../../budgets/domain/budget.repository.interface';
import { BudgetInstance } from '../../budgets/domain/budget-instance.entity';

export interface UpdatePeriodBudgetsCommand {
  periodId: string;
  budgets: Array<{
    categoryId: string;
    amountAllocated: bigint;
  }>;
}

@Injectable()
export class UpdatePeriodBudgetsUseCase {
  constructor(private readonly budgetRepository: BudgetRepository) {}

  async execute(
    command: UpdatePeriodBudgetsCommand,
  ): Promise<BudgetInstance[]> {
    // 1. Delete existing budgets for the period
    await this.budgetRepository.deleteAllByPeriod(command.periodId);

    // 2. Create new Budget Instances
    const budgetInstances = command.budgets
      .filter((b) => b.amountAllocated !== BigInt(0)) // Optional: don't save 0 budgets if desired
      .map((b) =>
        BudgetInstance.create({
          periodId: command.periodId,
          categoryId: b.categoryId,
          amountAllocated: b.amountAllocated,
        }),
      );

    // 3. Save new instances
    if (budgetInstances.length > 0) {
      await this.budgetRepository.saveBulk(budgetInstances);
    }

    return budgetInstances;
  }
}
