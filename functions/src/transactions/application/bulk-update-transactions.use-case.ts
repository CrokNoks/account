import { Injectable } from '@nestjs/common';
import { NotFoundError } from '../../shared/domain/errors';
import { TransactionRepository } from '../domain/transaction.repository.interface';
import { resolvePending } from '../domain/pending-rule';
import { AccountReferencesService } from '../../shared/application/account-references.service';

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
  constructor(
    private readonly transactionRepository: TransactionRepository,
    private readonly references: AccountReferencesService,
  ) {}

  async execute(command: BulkUpdateTransactionsCommand): Promise<void> {
    const { accountId, data } = command;
    const ids = [...new Set(command.ids)];

    await this.references.ensureReferences(accountId, data);

    // Tout est vérifié avant la première écriture : un id inconnu ou d'un
    // autre compte (même réponse) annule toute l'opération.
    const transactions =
      await this.transactionRepository.findAllByAccountUnpaginated(accountId);
    const byId = new Map(transactions.map((t) => [t.id, t]));
    const targets = ids.map((id) => byId.get(id));
    if (targets.some((tx) => !tx)) {
      throw new NotFoundError('Transaction not found');
    }

    for (const tx of targets) {
      if (!tx) continue;

      const updated = tx.update({
        categoryId:
          data.categoryId !== undefined ? data.categoryId : tx.categoryId,
        tagIds: data.tagIds !== undefined ? data.tagIds : tx.tagIds,
        reconciled:
          data.reconciled !== undefined ? data.reconciled : tx.reconciled,
        pending: resolvePending(data.reconciled, data.pending, tx.pending),
      });

      await this.transactionRepository.save(updated);
    }
  }
}
