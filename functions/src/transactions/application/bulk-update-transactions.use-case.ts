import { Injectable } from '@nestjs/common';
import { TransactionRepository } from '../domain/transaction.repository.interface';

export interface BulkUpdateTransactionsCommand {
  accountId: string;
  ids: string[];
  data: {
    categoryId?: string | null;
    tagIds?: string[];
    reconciled?: boolean;
    pending?: boolean;
  };
}

@Injectable()
export class BulkUpdateTransactionsUseCase {
  constructor(private readonly transactionRepository: TransactionRepository) {}

  async execute(command: BulkUpdateTransactionsCommand): Promise<void> {
    const { accountId, ids, data } = command;
    
    // We fetch them all to ensure they belong to the account (security)
    // In a real high-perf system, we might use a direct update with a where clause on account_id
    const transactions = await this.transactionRepository.findAllByAccountUnpaginated(accountId);
    const validIds = transactions.filter(t => ids.includes(t.id)).map(t => t.id);

    if (validIds.length === 0) return;

    for (const id of validIds) {
      const tx = transactions.find(t => t.id === id);
      if (!tx) continue;

      const updated = tx.update({
        categoryId: data.categoryId !== undefined ? data.categoryId : tx.categoryId,
        tagIds: data.tagIds !== undefined ? data.tagIds : tx.tagIds,
        reconciled: data.reconciled !== undefined ? data.reconciled : tx.reconciled,
        pending: data.pending !== undefined ? data.pending : tx.pending,
      });

      await this.transactionRepository.save(updated);
    }
  }
}
