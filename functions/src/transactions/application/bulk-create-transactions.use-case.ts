import { Injectable } from '@nestjs/common';
import { TransactionRepository } from '../domain/transaction.repository.interface';
import { Transaction } from '../domain/transaction.entity';
import { CreateTransactionCommand } from './create-transaction.use-case';

export interface BulkCreateTransactionsCommand {
  accountId: string;
  transactions: Array<Omit<CreateTransactionCommand, 'accountId'>>;
}

@Injectable()
export class BulkCreateTransactionsUseCase {
  constructor(private readonly repository: TransactionRepository) {}

  async execute(command: BulkCreateTransactionsCommand): Promise<Transaction[]> {
    const createdTransactions: Transaction[] = [];

    for (const dto of command.transactions) {
      const transaction = Transaction.create({
        ...dto,
        accountId: command.accountId,
      });
      await this.repository.save(transaction);
      createdTransactions.push(transaction);
    }

    return createdTransactions;
  }
}
