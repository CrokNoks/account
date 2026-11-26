import { Injectable, Logger } from '@nestjs/common';
import { TransactionRepository } from '../domain/transaction.repository.interface';
import { Transaction } from '../domain/transaction.entity';
import {
  checkMetadataKeepsLink,
  assertValidLink,
  checkTransferAmount,
  findOtherSide,
  planTransferUpdate,
} from '../domain/transfer-link';
import { ForbiddenError, NotFoundError } from '../../shared/domain/errors';
import { TransferWriteAccessService } from './transfer-write-access.service';

export interface UpdateTransferCommand {
  userId: string;
  /** Le côté du virement tel qu'enregistré. */
  existing: Transaction;
  /** Le même côté, avec les champs fournis appliqués (id et compte inchangés). */
  updated: Transaction;
}

/**
 * Modification d'un côté de virement (le contrôleur n'y aiguille que les
 * transactions portant `metadata.transferId`). Montant et date se propagent à
 * l'autre côté, écrits ensemble ; rien n'est écrit sans droit d'écriture sur
 * le compte lié. Jamais de bascule de période pour un virement.
 */
@Injectable()
export class UpdateTransferUseCase {
  private readonly logger = new Logger(UpdateTransferUseCase.name);

  constructor(
    private readonly transactionRepository: TransactionRepository,
    private readonly writeAccess: TransferWriteAccessService,
  ) {}

  async execute(command: UpdateTransferCommand): Promise<Transaction> {
    const { userId, existing, updated } = command;
    const transferId = existing.metadata?.transferId as string;
    const relatedAccountId = existing.metadata?.relatedAccountId as string;

    // Le lien ne se casse pas par `metadata`, même sans montant ni date.
    checkMetadataKeepsLink(existing.metadata, updated.metadata);

    const amountChanged = updated.amount !== existing.amount;
    const dateChanged = updated.date.getTime() !== existing.date.getTime();
    // Champs propres à ce côté seulement : l'autre côté n'est ni lu ni exigé.
    if (!amountChanged && !dateChanged) {
      return this.transactionRepository.save(updated);
    }

    // Lien incomplet : 409 avant tout contrôle de droit (jamais ensureCanWriteTo(undefined)).
    assertValidLink(existing);

    if (amountChanged) checkTransferAmount(existing, updated.amount);

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
          operation: 'update',
          transferId,
          relatedAccountId,
          reason: error instanceof NotFoundError ? 'not_found' : 'forbidden',
        });
      }
      throw error;
    }

    const candidates = await this.transactionRepository.findTransferSides(
      transferId,
      relatedAccountId,
    );
    const other = findOtherSide(existing, candidates);

    if (!other) {
      // Orphelin : on corrige le côté restant (Décision 1.2).
      this.logger.log({
        event: 'transfer_orphan_handled',
        operation: 'update',
        transferId,
        ids: [existing.id],
      });
      return this.transactionRepository.save(updated);
    }

    // Une seule transaction base : les deux côtés ou aucun.
    await this.transactionRepository.updateMany([
      updated,
      planTransferUpdate(other, updated),
    ]);
    this.logger.log({
      event: 'transfer_sync',
      operation: 'update',
      transferId,
      ids: [existing.id, other.id],
      sides: 2,
    });

    return (await this.transactionRepository.findById(updated.id)) ?? updated;
  }
}
