import { Injectable } from '@nestjs/common';
import { TransactionRepository } from '../domain/transaction.repository.interface';

export interface BulkDeleteTransactionsCommand {
  accountId: string;
  ids: string[];
}

@Injectable()
export class BulkDeleteTransactionsUseCase {
  constructor(private readonly transactionRepository: TransactionRepository) {}

  async execute(command: BulkDeleteTransactionsCommand): Promise<void> {
    const { accountId, ids } = command;
    
    // Security check: ensure they belong to the account
    const transactions = await this.transactionRepository.findAllByAccount(accountId);
    const validIds = transactions.filter(t => ids.includes(t.id)).map(t => t.id);

    if (validIds.length === 0) return;

    for (const id of validIds) {
      await this.transactionRepository.delete(id);
    }
  }
}
