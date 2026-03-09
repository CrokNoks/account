import { Injectable } from '@nestjs/common';
import { RecurringTransactionRepository } from '../domain/recurring-transaction.repository.interface';
import { RecurringTransaction } from '../domain/recurring-transaction.entity';

@Injectable()
export class GetRecurringTransactionsUseCase {
  constructor(private readonly repository: RecurringTransactionRepository) {}

  async execute(accountId: string): Promise<RecurringTransaction[]> {
    return this.repository.findAllByAccount(accountId);
  }
}
