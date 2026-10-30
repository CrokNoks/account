import { Injectable } from '@nestjs/common';
import { BudgetRepository } from '../../budgets/domain/budget.repository.interface';
import { BudgetInstance } from '../../budgets/domain/budget-instance.entity';
import { AccountReferencesService } from '../../shared/application/account-references.service';

export interface UpdatePeriodBudgetsCommand {
  accountId: string;
  periodId: string;
  budgets: Array<{
    categoryId: string;
    amountAllocated: bigint;
  }>;
}

@Injectable()
export class UpdatePeriodBudgetsUseCase {
  constructor(
    private readonly budgetRepository: BudgetRepository,
    private readonly references: AccountReferencesService,
  ) {}

  async execute(
    command: UpdatePeriodBudgetsCommand,
  ): Promise<BudgetInstance[]> {
    await this.references.ensureCategories(
      command.accountId,
      command.budgets.map((b) => b.categoryId),
    );

    // 1. Nouveaux budgets (les montants à 0 ne sont pas enregistrés)
    const budgetInstances = command.budgets
      .filter((b) => b.amountAllocated !== BigInt(0))
      .map((b) =>
        BudgetInstance.create({
          periodId: command.periodId,
          categoryId: b.categoryId,
          amountAllocated: b.amountAllocated,
        }),
      );

    // 2. Remplacement atomique : suppression des anciens + insertion des nouveaux
    // en une seule transaction (en cas d'échec, les anciens budgets restent).
    await this.budgetRepository.replaceForPeriod(
      command.periodId,
      budgetInstances,
    );

    return budgetInstances;
  }
}
