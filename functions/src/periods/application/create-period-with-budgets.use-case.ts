import { Injectable } from '@nestjs/common';
import { PeriodRepository } from '../domain/period.repository.interface';
import { Period } from '../domain/period.entity';
import { BudgetRepository } from '../../budgets/domain/budget.repository.interface';
import { BudgetInstance } from '../../budgets/domain/budget-instance.entity';
import { RecurringTransactionRepository } from '../../recurring/domain/recurring-transaction.repository.interface';
import { TransactionRepository } from '../../transactions/domain/transaction.repository.interface';
import { Transaction } from '../../transactions/domain/transaction.entity';

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
    private readonly budgetRepository: BudgetRepository,
    private readonly recurringRepository: RecurringTransactionRepository,
    private readonly transactionRepository: TransactionRepository,
  ) {}

  async execute(command: CreatePeriodWithBudgetsCommand): Promise<{ period: Period, budgets: BudgetInstance[] }> {
    // 0. Deactivate existing active periods for this account
    const existingPeriods = await this.periodRepository.findAllByAccount(command.accountId);
    for (const p of existingPeriods) {
      if (p.isActive) {
        (p as any).isActive = false;
        (p as any).updatedAt = new Date();
        await this.periodRepository.save(p);
      }
    }

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

    // 3. Handle Recurring Transactions injection
    const generatedTransactions: Transaction[] = [];
    if (command.injectRecurring) {
      const recurring = await this.recurringRepository.findAllByAccount(command.accountId);
      
      for (const rec of recurring) {
        // Calculate the date for this month
        const transactionDate = new Date(command.startDate);
        // Set to the specific day, handling end of month (e.g. 31st in Feb)
        const lastDayOfMonth = new Date(transactionDate.getFullYear(), transactionDate.getMonth() + 1, 0).getDate();
        const day = Math.min(rec.dayOfMonth, lastDayOfMonth);
        transactionDate.setDate(day);

        // Ensure date is within period range (if period is shorter than a month or unusual)
        if (transactionDate >= command.startDate && transactionDate <= command.endDate) {
          generatedTransactions.push(Transaction.create({
            accountId: command.accountId,
            categoryId: rec.categoryId,
            description: rec.description,
            amount: rec.amount,
            date: transactionDate,
            periodId: period.id,
            reconciled: false,
            pending: true,
            metadata: { source: 'recurring', recurringId: rec.id }
          }));
        }
      }
    }

    // 4. Save everything
    await this.periodRepository.save(period);
    if (budgetInstances.length > 0) {
      await this.budgetRepository.saveBulk(budgetInstances);
    }
    for (const t of generatedTransactions) {
      await this.transactionRepository.save(t);
    }

    return { period, budgets: budgetInstances };
  }
}
