import { Injectable } from '@nestjs/common';
import { RecurringTransactionRepository } from '../domain/recurring-transaction.repository.interface';

@Injectable()
export class DeleteRecurringTransactionUseCase {
  constructor(private readonly repository: RecurringTransactionRepository) {}

  async execute(id: string): Promise<void> {
    await this.repository.delete(id);
  }
}
