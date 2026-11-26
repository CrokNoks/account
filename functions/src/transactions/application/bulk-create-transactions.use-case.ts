import { parseDateOnly, todayDateOnly } from '../../shared/domain/date-only';
import { Injectable, Logger } from '@nestjs/common';
import { TransactionRepository } from '../domain/transaction.repository.interface';
import { Transaction } from '../domain/transaction.entity';
import { MatchSmartRulesUseCase } from '../../smart-rules/application/match-smart-rules.use-case';
import { CreateTransactionCommand } from './create-transaction.use-case';
import { AccountReferencesService } from '../../shared/application/account-references.service';
import {
  ApplyPeriodSwitchService,
  PeriodSwitchInfo,
} from '../../periods/application/apply-period-switch.service';

export interface BulkCreateTransactionsCommand {
  accountId: string;
  transactions: Array<Omit<CreateTransactionCommand, 'accountId'>>;
  /** Comptage de l'écran d'import, pour la mesure seulement (aucun effet sur l'écriture). */
  importStats?: { excluded: number; rechecked: number; closeFlagged: number };
}

export interface BulkCreateTransactionsResult {
  transactions: Transaction[];
  /** Dernière bascule déclenchée par l'import (null : aucune). */
  periodSwitch: PeriodSwitchInfo | null;
}

@Injectable()
export class BulkCreateTransactionsUseCase {
  private readonly logger = new Logger(BulkCreateTransactionsUseCase.name);

  constructor(
    private readonly transactionRepository: TransactionRepository,
    private readonly matchRulesUseCase: MatchSmartRulesUseCase,
    private readonly references: AccountReferencesService,
    private readonly periodSwitch: ApplyPeriodSwitchService,
  ) {}

  async execute(
    command: BulkCreateTransactionsCommand,
  ): Promise<BulkCreateTransactionsResult> {
    const result = await this.createAll(command);
    const { importStats } = command;
    if (importStats) {
      // Après l'écriture réussie, nombres seulement : ni libellé ni montant.
      this.logger.log(
        `Import review: sent=${command.transactions.length} excluded=${importStats.excluded} rechecked=${importStats.rechecked} closeFlagged=${importStats.closeFlagged}`,
      );
    }
    return result;
  }

  private async createAll(
    command: BulkCreateTransactionsCommand,
  ): Promise<BulkCreateTransactionsResult> {
    const { accountId, transactions } = command;
    const createdTransactions: Transaction[] = [];

    // Tout est vérifié avant la première écriture puis tout est écrit en un seul appel atomique.
    for (const dto of transactions) {
      await this.references.ensureReferences(accountId, dto);
    }

    for (const dto of transactions) {
      let categoryId = dto.categoryId;
      let tagIds = dto.tagIds || [];

      // If no category provided, try to apply rules
      if (!categoryId) {
        const ruleMatch = await this.matchRulesUseCase.execute(
          accountId,
          dto.description,
        );
        if (ruleMatch.categoryId) categoryId = ruleMatch.categoryId;
        if (ruleMatch.tagIds.length > 0)
          tagIds = [...tagIds, ...ruleMatch.tagIds];
      }

      const transaction = Transaction.create({
        ...dto,
        accountId,
        categoryId,
        tagIds,
        date: dto.date ? parseDateOnly(dto.date) : todayDateOnly(),
        amount: BigInt(dto.amount),
        reconciled: dto.reconciled ?? false,
        pending: dto.pending ?? false,
      });

      createdTransactions.push(transaction);
    }

    // Une seule écriture atomique : toutes les lignes (et leurs tags) ou aucune.
    if (createdTransactions.length === 0) {
      return { transactions: [], periodSwitch: null };
    }

    // Les paies du lot peuvent déclencher des bascules (dans l'ordre des dates),
    // chaque ligne allant dans la période qui contient sa date : un seul appel atomique.
    const switched = await this.periodSwitch.process({
      accountId,
      mode: 'create',
      cleanup: true,
      transactions: createdTransactions,
    });
    if (switched.written) {
      return {
        transactions: switched.transactions,
        periodSwitch: switched.periodSwitch,
      };
    }
    return {
      transactions:
        await this.transactionRepository.saveMany(createdTransactions),
      periodSwitch: null,
    };
  }
}
