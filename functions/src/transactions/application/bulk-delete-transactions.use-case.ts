import { Injectable, Logger } from '@nestjs/common';
import { TransactionRepository } from '../domain/transaction.repository.interface';
import { Transaction } from '../domain/transaction.entity';
import { assertValidLink, findOtherSide } from '../domain/transfer-link';
import { ForbiddenError, NotFoundError } from '../../shared/domain/errors';
import { ensureBelongsToAccount } from '../../shared/domain/account-ownership';
import { TransferWriteAccessService } from './transfer-write-access.service';

export interface BulkDeleteTransactionsCommand {
  userId: string;
  accountId: string;
  ids: string[];
}

export interface DeleteTransactionCommand {
  userId: string;
  accountId: string;
  id: string;
}

/**
 * Suppression simple et en lot : une seule règle. Supprimer un côté de
 * virement supprime l'autre, après contrôle du droit d'écriture sur le compte lié.
 */
@Injectable()
export class BulkDeleteTransactionsUseCase {
  private readonly logger = new Logger(BulkDeleteTransactionsUseCase.name);

  constructor(
    private readonly transactionRepository: TransactionRepository,
    private readonly writeAccess: TransferWriteAccessService,
  ) {}

  async execute(command: BulkDeleteTransactionsCommand): Promise<void> {
    const { accountId, userId } = command;
    const ids = [...new Set(command.ids)];

    // Tout est vérifié avant la première suppression : un id inconnu ou d'un
    // autre compte (même réponse) annule toute l'opération.
    const transactions =
      await this.transactionRepository.findAllByAccountUnpaginated(accountId);
    const requested = new Set(ids);
    const known = new Set(transactions.map((t) => t.id));
    if (ids.some((id) => !known.has(id))) {
      throw new NotFoundError('Transaction not found');
    }

    await this.deleteWithOtherSides(
      transactions.filter((t) => requested.has(t.id)),
      userId,
    );
  }

  async deleteOne(command: DeleteTransactionCommand): Promise<void> {
    const self = ensureBelongsToAccount(
      await this.transactionRepository.findById(command.id),
      command.accountId,
      'Transaction',
    );
    await this.deleteWithOtherSides([self], command.userId);
  }

  private async deleteWithOtherSides(
    selves: Transaction[],
    userId: string,
  ): Promise<void> {
    const linked = selves.filter((t) => t.metadata?.transferId);
    // Lien incomplet : 409 avant tout contrôle de droit ou suppression.
    linked.forEach(assertValidLink);

    // Le droit d'écriture est contrôlé avant toute suppression, une fois par
    // compte lié : un seul refus annule tout le lot.
    const relatedAccountIds = new Set(
      linked.map((t) => t.metadata?.relatedAccountId as string),
    );
    for (const relatedAccountId of relatedAccountIds) {
      try {
        await this.writeAccess.ensureCanWriteTo(relatedAccountId, userId, {
          notFound: 'Account not found',
          forbidden:
            'Write access to the other account of the transfer is required',
        });
      } catch (error) {
        if (error instanceof ForbiddenError || error instanceof NotFoundError) {
          this.logger.warn({
            event: 'transfer_sync_denied',
            operation: 'delete',
            relatedAccountId,
            reason: error instanceof NotFoundError ? 'not_found' : 'forbidden',
          });
        }
        throw error;
      }
    }

    // Un Set : une ligne présente deux fois (les deux côtés dans le lot) n'est supprimée qu'une fois.
    const toDelete = new Set(selves.map((t) => t.id));
    const orphans: string[] = [];
    for (const self of linked) {
      const transferId = self.metadata?.transferId as string;
      const candidates = await this.transactionRepository.findTransferSides(
        transferId,
        self.metadata?.relatedAccountId as string,
      );
      const other = findOtherSide(self, candidates);
      if (other) toDelete.add(other.id);
      else orphans.push(self.id);
    }

    // Une seule requête : toutes les transactions sont supprimées, ou aucune.
    await this.transactionRepository.deleteMany([...toDelete]);

    if (linked.length > 0) {
      this.logger.log({
        event: 'transfer_sync',
        operation: 'delete',
        ids: [...toDelete],
        deleted: toDelete.size,
      });
    }
    for (const id of orphans) {
      this.logger.log({
        event: 'transfer_orphan_handled',
        operation: 'delete',
        ids: [id],
      });
    }
  }
}
