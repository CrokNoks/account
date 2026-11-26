import { Injectable } from '@nestjs/common';
import { NotFoundError } from '../../shared/domain/errors';
import { TransactionRepository } from '../domain/transaction.repository.interface';
import { isLeavingPending, resolvePending } from '../domain/pending-rule';
import { AccountReferencesService } from '../../shared/application/account-references.service';
import {
  ApplyPeriodSwitchService,
  PeriodSwitchInfo,
} from '../../periods/application/apply-period-switch.service';

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
    private readonly periodSwitch: ApplyPeriodSwitchService,
  ) {}

  async execute(
    command: BulkUpdateTransactionsCommand,
  ): Promise<{ periodSwitch: PeriodSwitchInfo | null }> {
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

    const leavingPendingIds = new Set<string>();
    const updatedTransactions = targets.flatMap((tx) => {
      if (!tx) return [];

      const updated = tx.update({
        categoryId:
          data.categoryId !== undefined ? data.categoryId : tx.categoryId,
        tagIds: data.tagIds !== undefined ? data.tagIds : tx.tagIds,
        reconciled:
          data.reconciled !== undefined ? data.reconciled : tx.reconciled,
        pending: resolvePending(
          data.reconciled,
          data.pending,
          tx.pending,
          tx.reconciled,
        ),
      });
      if (isLeavingPending(tx.pending, updated.pending)) {
        leavingPendingIds.add(tx.id);
      }
      return updated;
    });
    if (updatedTransactions.length === 0) return { periodSwitch: null };

    // Sortir du pending une paie : date du jour et, si les règles le permettent,
    // bascule de période, dans la même écriture atomique (une bascule au plus par lot).
    const switched = await this.periodSwitch.process({
      accountId,
      mode: 'update',
      transactions: updatedTransactions,
      leavingPendingIds,
    });
    if (switched.written) return { periodSwitch: switched.periodSwitch };

    // Une seule écriture atomique : toutes les transactions sont modifiées, ou aucune.
    await this.transactionRepository.updateMany(switched.transactions);
    return { periodSwitch: null };
  }
}
