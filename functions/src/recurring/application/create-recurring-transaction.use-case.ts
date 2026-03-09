import { Injectable } from '@nestjs/common';
import { RecurringTransactionRepository } from '../domain/recurring-transaction.repository.interface';
import { RecurringTransaction } from '../domain/recurring-transaction.entity';

export interface CreateRecurringTransactionCommand {
  accountId: string;
  categoryId: string | null;
  description: string;
  amount: bigint;
  dayOfMonth: number;
}

@Injectable()
export class CreateRecurringTransactionUseCase {
  constructor(private readonly repository: RecurringTransactionRepository) {}

  async execute(command: CreateRecurringTransactionCommand): Promise<RecurringTransaction> {
    const recurring = RecurringTransaction.create(command);
    await this.repository.save(recurring);
    return recurring;
  }
}
