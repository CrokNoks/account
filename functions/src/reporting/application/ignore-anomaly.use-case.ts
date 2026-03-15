import { Injectable } from '@nestjs/common';
import { TransactionRepository } from '../../transactions/domain/transaction.repository.interface';
import { Transaction } from '../../transactions/domain/transaction.entity';

@Injectable()
export class IgnoreAnomalyUseCase {
  constructor(private readonly transactionRepository: TransactionRepository) {}

  async execute(
    accountId: string,
    transactionIds: string[],
    type: string,
  ): Promise<void> {
    for (const id of transactionIds) {
      const tx = await this.transactionRepository.findById(id);
      if (!tx || tx.accountId !== accountId) continue;

      const metadata = tx.metadata || {};
      const ignoredAnomalies = new Set<string>(metadata.ignoredAnomalies || []);
      ignoredAnomalies.add(type);

      const updated = new Transaction({
        ...tx,
        metadata: {
          ...metadata,
          ignoredAnomalies: Array.from(ignoredAnomalies),
        },
        updatedAt: new Date(),
      });

      await this.transactionRepository.save(updated);
    }
  }
}
