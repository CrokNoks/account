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
      console.log(`[CreatePeriodWithBudgetsUseCase] Found ${recurring.length} recurring transactions for account ${command.accountId}`);
      
      for (const rec of recurring) {
        // Calculate the date for this month
        const transactionDate = new Date(command.startDate);
        // Set to the specific day, handling end of month (e.g. 31st in Feb)
        const lastDayOfMonth = new Date(transactionDate.getFullYear(), transactionDate.getMonth() + 1, 0).getDate();
        const day = Math.min(rec.dayOfMonth, lastDayOfMonth);
        transactionDate.setDate(day);

        console.log(`[CreatePeriodWithBudgetsUseCase] Processing recurring: ${rec.description} for day ${day}. Calculated date: ${transactionDate.toISOString()}. Range: ${command.startDate.toISOString()} - ${command.endDate.toISOString()}`);

        // Ensure date is within period range
        if (transactionDate >= command.startDate && transactionDate <= command.endDate) {
          const t = Transaction.create({
            accountId: command.accountId,
            categoryId: rec.categoryId,
            description: rec.description,
            amount: rec.amount,
            date: transactionDate,
            periodId: period.id,
            reconciled: false,
            metadata: { source: 'recurring', recurringId: rec.id }
          });
          generatedTransactions.push(t);
          console.log(`[CreatePeriodWithBudgetsUseCase] Generated transaction: ${rec.description}`);
        } else {
          console.warn(`[CreatePeriodWithBudgetsUseCase] Transaction date ${transactionDate.toISOString()} is out of range!`);
        }
      }
    }

    // 4. Save everything
    await this.periodRepository.save(period);
    if (budgetInstances.length > 0) {
      await this.budgetRepository.saveBulk(budgetInstances);
    }
    console.log(`[CreatePeriodWithBudgetsUseCase] Saving ${generatedTransactions.length} generated transactions`);
    for (const t of generatedTransactions) {
      await this.transactionRepository.save(t);
    }

    return { period, budgets: budgetInstances };
  }
}
