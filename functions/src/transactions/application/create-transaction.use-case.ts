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
  paymentMethod?: string | null;
  notes?: string | null;
  metadata?: Record<string, any>;
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
      reconciled: false,
    });

    await this.transactionRepository.save(transaction);
    return transaction;
  }
}
