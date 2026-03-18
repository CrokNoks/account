import { Injectable } from '@nestjs/common';
import { TransactionRepository } from '../domain/transaction.repository.interface';
import { Transaction } from '../domain/transaction.entity';

export interface CreateTransactionCommand {
  accountId: string;
  categoryId: string | null;
  periodId?: string | null;
  date: Date;
  description: string;
  amount: bigint;
  reconciled?: boolean;
  pending?: boolean;
  paymentMethod?: string | null;
  notes?: string | null;
  metadata?: Record<string, any>;
  tagIds?: string[];
  savingsGoalId?: string | null;
}

@Injectable()
export class CreateTransactionUseCase {
  constructor(private readonly transactionRepository: TransactionRepository) {}

  async execute(command: CreateTransactionCommand): Promise<Transaction> {
    const transaction = Transaction.create({
      accountId: command.accountId,
      categoryId: command.categoryId,
      periodId: command.periodId,
      date: command.date,
      description: command.description,
      amount: command.amount,
      paymentMethod: command.paymentMethod,
      notes: command.notes,
      metadata: command.metadata || {},
      reconciled: command.reconciled ?? false,
      pending: command.pending ?? false,
      tagIds: command.tagIds || [],
      savingsGoalId: command.savingsGoalId || null,
    });

    await this.transactionRepository.save(transaction);
    return transaction;
  }
}
