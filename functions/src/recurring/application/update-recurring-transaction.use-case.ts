import { Injectable } from '@nestjs/common';
import { RecurringTransactionRepository } from '../domain/recurring-transaction.repository.interface';
import { RecurringTransaction } from '../domain/recurring-transaction.entity';

@Injectable()
export class UpdateRecurringTransactionUseCase {
  constructor(private readonly repository: RecurringTransactionRepository) {}

  async execute(id: string, data: Partial<Omit<RecurringTransaction, 'id' | 'accountId' | 'createdAt' | 'updatedAt'>>): Promise<RecurringTransaction> {
    const existing = await this.repository.findById(id);
    if (!existing) throw new Error('Recurring transaction not found');

    const updated = new RecurringTransaction({
      ...existing,
      ...data,
      updatedAt: new Date(),
    });

    await this.repository.save(updated);
    return updated;
  }
}
