import { Injectable } from '@nestjs/common';
import { TransactionRepository } from '../domain/transaction.repository.interface';
import { NotFoundError } from '../../shared/domain/errors';

export interface BulkDeleteTransactionsCommand {
  accountId: string;
  ids: string[];
}

@Injectable()
export class BulkDeleteTransactionsUseCase {
  constructor(private readonly transactionRepository: TransactionRepository) {}

  async execute(command: BulkDeleteTransactionsCommand): Promise<void> {
    const { accountId } = command;
    const ids = [...new Set(command.ids)];

    // Tout est vérifié avant la première suppression : un id inconnu ou d'un
    // autre compte (même réponse) annule toute l'opération.
    const transactions =
      await this.transactionRepository.findAllByAccountUnpaginated(accountId);
    const knownIds = new Set(transactions.map((t) => t.id));
    if (ids.some((id) => !knownIds.has(id))) {
      throw new NotFoundError('Transaction not found');
    }

    // Une seule requête : toutes les transactions sont supprimées, ou aucune.
    await this.transactionRepository.deleteMany(ids);
  }
}
