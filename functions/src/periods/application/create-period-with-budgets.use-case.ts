import { Injectable, Logger } from '@nestjs/common';
import { PeriodRepository } from '../domain/period.repository.interface';
import { Period, ensureCanBeCreated } from '../domain/period.entity';
import { BudgetInstance } from '../../budgets/domain/budget-instance.entity';
import { RecurringTransactionRepository } from '../../recurring/domain/recurring-transaction.repository.interface';
import { Transaction } from '../../transactions/domain/transaction.entity';
import { recurringOccurrences } from '../../shared/domain/recurring-day';
import { AccountReferencesService } from '../../shared/application/account-references.service';
import { toDateOnly } from '../../shared/domain/date-only';
import { dueDateMetadata } from '../../shared/domain/recurring-due-date';

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
  private readonly logger = new Logger(CreatePeriodWithBudgetsUseCase.name);

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

    // Règle partagée avec la réactivation : jamais avant une période existante
    ensureCanBeCreated(
      period,
      await this.periodRepository.findAllByAccount(command.accountId),
    );

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
        // Toutes les dates où le jour tombe dans la période (à cheval sur deux
        // mois, plus d'un mois), jour ramené au dernier jour d'un mois court.
        for (const transactionDate of recurringOccurrences(
          rec.dayOfMonth,
          command.startDate,
          command.endDate,
        )) {
          generatedTransactions.push(
            Transaction.create({
              accountId: command.accountId,
              categoryId: rec.categoryId,
              description: rec.description,
              amount: rec.amount,
              date: transactionDate,
              reconciled: false,
              pending: true,
              metadata: {
                source: 'recurring',
                recurringId: rec.id,
                ...dueDateMetadata(transactionDate),
              },
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

    // Mesure d'impact : part des périodes ouvertes par le déclencheur
    // (`origin: 'trigger'`, voir ApplyPeriodSwitchService) plutôt qu'à la main.
    this.logger.log({
      event: 'period_opened',
      origin: 'manual',
      accountId: command.accountId,
      periodId: period.id,
      start: toDateOnly(period.startDate),
      end: toDateOnly(command.endDate),
      injected: generatedTransactions.length,
      nextPaie: false,
    });

    return { period, budgets: budgetInstances };
  }
}
