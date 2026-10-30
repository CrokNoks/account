import { Injectable } from '@nestjs/common';
import { PeriodRepository } from '../domain/period.repository.interface';
import { Period } from '../domain/period.entity';
import { BudgetInstance } from '../../budgets/domain/budget-instance.entity';
import { RecurringTransactionRepository } from '../../recurring/domain/recurring-transaction.repository.interface';
import { Transaction } from '../../transactions/domain/transaction.entity';
import { recurringDayInMonth } from '../../shared/domain/recurring-day';
import { AccountReferencesService } from '../../shared/application/account-references.service';

export interface CreatePeriodWithBudgetsCommand {
  accountId: string;
  startDate: Date;
  endDate: Date;
  budgets: Array<{
    categoryId: string;
    amountAllocated: bigint;
  }>;
  injectRecurring?: boolean;
}

@Injectable()
export class CreatePeriodWithBudgetsUseCase {
  constructor(
    private readonly periodRepository: PeriodRepository,
    private readonly recurringRepository: RecurringTransactionRepository,
    private readonly references: AccountReferencesService,
  ) {}

  async execute(
    command: CreatePeriodWithBudgetsCommand,
  ): Promise<{ period: Period; budgets: BudgetInstance[] }> {
    await this.references.ensureCategories(
      command.accountId,
      command.budgets.map((b) => b.categoryId),
    );

    // 1. Create Period
    const period = Period.create({
      accountId: command.accountId,
      startDate: command.startDate,
      endDate: command.endDate,
    });

    // 2. Create Budget Instances
    const budgetInstances = command.budgets.map((b) =>
      BudgetInstance.create({
        periodId: period.id,
        categoryId: b.categoryId,
        amountAllocated: b.amountAllocated,
      }),
    );

    // 3. Handle Recurring Transactions injection
    const generatedTransactions: Transaction[] = [];
    if (command.injectRecurring) {
      const recurring = await this.recurringRepository.findAllByAccount(
        command.accountId,
      );

      for (const rec of recurring) {
        // Calculate the date for this month
        const transactionDate = new Date(command.startDate);
        // Jour demandé, ramené au dernier jour du mois s'il n'existe pas (31 en février)
        const day = recurringDayInMonth(rec.dayOfMonth, transactionDate);
        transactionDate.setDate(day);

        // Ensure date is within period range (if period is shorter than a month or unusual)
        if (
          transactionDate >= command.startDate &&
          transactionDate <= command.endDate
        ) {
          generatedTransactions.push(
            Transaction.create({
              accountId: command.accountId,
              categoryId: rec.categoryId,
              description: rec.description,
              amount: rec.amount,
              date: transactionDate,
              periodId: period.id,
              reconciled: false,
              pending: true,
              metadata: { source: 'recurring', recurringId: rec.id },
            }),
          );
        }
      }
    }

    // 4. Écriture atomique : désactivation des autres périodes actives du compte,
    // période, budgets et transactions récurrentes, en une seule transaction.
    await this.periodRepository.createWithBudgets(
      period,
      budgetInstances,
      generatedTransactions,
    );

    return { period, budgets: budgetInstances };
  }
}
