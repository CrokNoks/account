import { Injectable } from '@nestjs/common';
import { TransactionRepository } from '../domain/transaction.repository.interface';
import { Transaction } from '../domain/transaction.entity';
import { MatchSmartRulesUseCase } from '../../smart-rules/application/match-smart-rules.use-case';
import { CreateTransactionCommand } from './create-transaction.use-case';
import { AccountReferencesService } from '../../shared/application/account-references.service';

export interface BulkCreateTransactionsCommand {
  accountId: string;
  transactions: Array<Omit<CreateTransactionCommand, 'accountId'>>;
}

@Injectable()
export class BulkCreateTransactionsUseCase {
  constructor(
    private readonly transactionRepository: TransactionRepository,
    private readonly matchRulesUseCase: MatchSmartRulesUseCase,
    private readonly references: AccountReferencesService,
  ) {}

  async execute(
    command: BulkCreateTransactionsCommand,
  ): Promise<Transaction[]> {
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
        date: dto.date ? new Date(dto.date) : new Date(),
        amount: BigInt(dto.amount),
        reconciled: dto.reconciled ?? false,
        pending: dto.pending ?? false,
      });

      createdTransactions.push(transaction);
    }

    // Une seule écriture atomique : toutes les lignes (et leurs tags) ou aucune.
    if (createdTransactions.length > 0) {
      await this.transactionRepository.saveMany(createdTransactions);
    }

    return createdTransactions;
  }
}
