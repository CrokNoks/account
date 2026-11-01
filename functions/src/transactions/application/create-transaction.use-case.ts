import { Injectable } from '@nestjs/common';
import { TransactionRepository } from '../domain/transaction.repository.interface';
import { Transaction } from '../domain/transaction.entity';
import { AccountReferencesService } from '../../shared/application/account-references.service';

export interface CreateTransactionCommand {
  accountId: string;
  categoryId: string | null;
  periodId?: string | null;
  date: Date;
  description: string;
  amount: bigint;
  reconciled?: boolean;
  pending?: boolean;
  notes?: string | null;
  metadata?: Record<string, any>;
  tagIds?: string[];
}

@Injectable()
export class CreateTransactionUseCase {
  constructor(
    private readonly transactionRepository: TransactionRepository,
    private readonly references: AccountReferencesService,
  ) {}

  async execute(command: CreateTransactionCommand): Promise<Transaction> {
    await this.references.ensureReferences(command.accountId, command);

    const transaction = Transaction.create({
      accountId: command.accountId,
      categoryId: command.categoryId,
      periodId: command.periodId,
      date: command.date,
      description: command.description,
      amount: command.amount,
      notes: command.notes,
      metadata: command.metadata || {},
      reconciled: command.reconciled ?? false,
      pending: command.pending ?? false,
      tagIds: command.tagIds || [],
    });

    return this.transactionRepository.save(transaction);
  }
}
