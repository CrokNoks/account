import { Injectable } from '@nestjs/common';
import { ensureBelongsToAccount } from '../../shared/domain/account-ownership';
import { RecurringTransactionRepository } from '../domain/recurring-transaction.repository.interface';

@Injectable()
export class DeleteRecurringTransactionUseCase {
  constructor(private readonly repository: RecurringTransactionRepository) {}

  async execute(accountId: string, id: string): Promise<void> {
    ensureBelongsToAccount(
      await this.repository.findById(id),
      accountId,
      'Recurring transaction',
    );
    await this.repository.delete(id);
  }
}
