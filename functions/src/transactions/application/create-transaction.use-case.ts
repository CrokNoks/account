import { Injectable } from '@nestjs/common';
import { TransactionRepository } from '../domain/transaction.repository.interface';
import { Transaction } from '../domain/transaction.entity';
import { AccountReferencesService } from '../../shared/application/account-references.service';
import {
  ApplyPeriodSwitchService,
  PeriodSwitchInfo,
} from '../../periods/application/apply-period-switch.service';

export interface CreateTransactionCommand {
  accountId: string;
  categoryId: string | null;
  date: Date;
  description: string;
  amount: bigint;
  reconciled?: boolean;
  pending?: boolean;
  notes?: string | null;
  metadata?: Record<string, any>;
  tagIds?: string[];
}

export interface CreateTransactionResult {
  transaction: Transaction;
  /** Bascule de période déclenchée par cette transaction (null : aucune). */
  periodSwitch: PeriodSwitchInfo | null;
}

@Injectable()
export class CreateTransactionUseCase {
  constructor(
    private readonly transactionRepository: TransactionRepository,
    private readonly references: AccountReferencesService,
    private readonly periodSwitch: ApplyPeriodSwitchService,
  ) {}

  async execute(
    command: CreateTransactionCommand,
  ): Promise<CreateTransactionResult> {
    await this.references.ensureReferences(command.accountId, command);

    const transaction = Transaction.create({
      accountId: command.accountId,
      categoryId: command.categoryId,
      date: command.date,
      description: command.description,
      amount: command.amount,
      notes: command.notes,
      metadata: command.metadata || {},
      reconciled: command.reconciled ?? false,
      pending: command.pending ?? false,
      tagIds: command.tagIds || [],
    });

    // Une transaction de la catégorie déclencheuse peut clore la période active
    // et en ouvrir une autre : écriture atomique faite par le service.
    const switched = await this.periodSwitch.process({
      accountId: command.accountId,
      mode: 'create',
      transactions: [transaction],
    });
    if (switched.written) {
      return {
        transaction: switched.transactions[0],
        periodSwitch: switched.periodSwitch,
      };
    }
    return {
      transaction: await this.transactionRepository.save(transaction),
      periodSwitch: null,
    };
  }
}
