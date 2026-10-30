import { Injectable } from '@nestjs/common';
import { RecurringTransactionRepository } from '../domain/recurring-transaction.repository.interface';
import { RecurringTransaction } from '../domain/recurring-transaction.entity';
import { ensureBelongsToAccount } from '../../shared/domain/account-ownership';

@Injectable()
export class UpdateRecurringTransactionUseCase {
  constructor(private readonly repository: RecurringTransactionRepository) {}

  async execute(
    accountId: string,
    id: string,
    data: Partial<
      Omit<RecurringTransaction, 'id' | 'accountId' | 'createdAt' | 'updatedAt'>
    >,
  ): Promise<RecurringTransaction> {
    const existing = ensureBelongsToAccount(
      await this.repository.findById(id),
      accountId,
      'Recurring transaction',
    );

    const updated = new RecurringTransaction({
      ...existing,
      ...data,
      updatedAt: new Date(),
    });

    await this.repository.save(updated);
    return updated;
  }
}
