import { Injectable } from '@nestjs/common';
import { TransactionRepository } from '../../transactions/domain/transaction.repository.interface';
import { ensureBelongsToAccount } from '../../shared/domain/account-ownership';
import { Transaction } from '../../transactions/domain/transaction.entity';

@Injectable()
export class IgnoreAnomalyUseCase {
  constructor(private readonly transactionRepository: TransactionRepository) {}

  async execute(
    accountId: string,
    transactionIds: string[],
    type: string,
  ): Promise<void> {
    // Tout est vérifié avant la première écriture : 404 identique pour une
    // transaction inconnue et pour celle d'un autre compte.
    const transactions: Transaction[] = [];
    for (const id of transactionIds) {
      transactions.push(
        ensureBelongsToAccount(
          await this.transactionRepository.findById(id),
          accountId,
          'Transaction',
        ),
      );
    }

    for (const tx of transactions) {
      const metadata = (tx.metadata as Record<string, any>) || {};
      const ignoredAnomalies = new Set<string>(
        (metadata.ignoredAnomalies as string[]) || [],
      );
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
