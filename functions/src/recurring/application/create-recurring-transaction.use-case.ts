import { Injectable } from '@nestjs/common';
import { RecurringTransactionRepository } from '../domain/recurring-transaction.repository.interface';
import { RecurringTransaction } from '../domain/recurring-transaction.entity';
import { AccountReferencesService } from '../../shared/application/account-references.service';

export interface CreateRecurringTransactionCommand {
  accountId: string;
  categoryId: string | null;
  description: string;
  amount: bigint;
  dayOfMonth: number;
}

@Injectable()
export class CreateRecurringTransactionUseCase {
  constructor(
    private readonly repository: RecurringTransactionRepository,
    private readonly references: AccountReferencesService,
  ) {}

  async execute(
    command: CreateRecurringTransactionCommand,
  ): Promise<RecurringTransaction> {
    await this.references.ensureCategories(command.accountId, [
      command.categoryId,
    ]);
    const recurring = RecurringTransaction.create(command);
    await this.repository.save(recurring);
    return recurring;
  }
}
