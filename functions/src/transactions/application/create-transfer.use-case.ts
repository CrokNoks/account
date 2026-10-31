import { Injectable } from '@nestjs/common';
import { TransactionRepository } from '../domain/transaction.repository.interface';
import { Transaction } from '../domain/transaction.entity';
import * as crypto from 'crypto';
import {
  DomainValidationError,
  ForbiddenError,
  NotFoundError,
} from '../../shared/domain/errors';
import { AccountRepository } from '../../accounts/domain/account.repository.interface';
import { AccountShareRepository } from '../../accounts/domain/account-share.repository.interface';

export interface CreateTransferCommand {
  /** Utilisateur qui fait le virement. */
  userId: string;
  sourceAccountId: string;
  destinationAccountId: string;
  amount: bigint; // positive amount in cents
  date: Date;
  description: string;
}

@Injectable()
export class CreateTransferUseCase {
  constructor(
    private readonly transactionRepository: TransactionRepository,
    private readonly accountRepository: AccountRepository,
    private readonly accountShareRepository: AccountShareRepository,
  ) {}

  async execute(
    command: CreateTransferCommand,
  ): Promise<[Transaction, Transaction]> {
    if (command.amount <= BigInt(0)) {
      throw new DomainValidationError(
        'Transfer amount must be strictly positive',
      );
    }
    if (command.sourceAccountId === command.destinationAccountId) {
      throw new DomainValidationError(
        'Source and destination accounts must be different',
      );
    }

    await this.ensureCanWriteTo(command.destinationAccountId, command.userId);

    const transferId = crypto.randomUUID();

    const sourceTransaction = Transaction.create({
      accountId: command.sourceAccountId,
      categoryId: null,
      date: command.date,
      description: command.description,
      amount: -command.amount,
      metadata: {
        transferId,
        type: 'transfer_out',
        relatedAccountId: command.destinationAccountId,
      },
      reconciled: false,
      pending: false,
    });

    const destinationTransaction = Transaction.create({
      accountId: command.destinationAccountId,
      categoryId: null,
      date: command.date,
      description: command.description,
      amount: command.amount,
      metadata: {
        transferId,
        type: 'transfer_in',
        relatedAccountId: command.sourceAccountId,
      },
      reconciled: false,
      pending: false,
    });

    // Une seule écriture atomique : les deux lignes ou aucune.
    return this.transactionRepository.saveTransfer(
      sourceTransaction,
      destinationTransaction,
    );
  }

  /**
   * Le compte de destination doit être accessible (la lecture passe par la RLS :
   * introuvable = 404) et en écriture : propriétaire, ou partage « write ».
   * Un utilisateur peut lire sa propre ligne de partage (policy
   * « Owners can view shares for their accounts », `user_id = auth.uid()`).
   */
  private async ensureCanWriteTo(
    accountId: string,
    userId: string,
  ): Promise<void> {
    const account = await this.accountRepository.findById(accountId);
    if (!account) throw new NotFoundError('Destination account not found');
    if (account.ownerId === userId) return;

    const shares =
      await this.accountShareRepository.findAllByAccount(accountId);
    const mine = shares.find((s) => s.userId === userId);
    if (mine?.permission !== 'write') {
      throw new ForbiddenError(
        'Write access to the destination account is required',
      );
    }
  }
}
