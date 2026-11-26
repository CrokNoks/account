import { Injectable } from '@nestjs/common';
import { TransactionRepository } from '../domain/transaction.repository.interface';
import { Transaction } from '../domain/transaction.entity';
import * as crypto from 'crypto';
import { DomainValidationError } from '../../shared/domain/errors';
import { TransferWriteAccessService } from './transfer-write-access.service';
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
  private readonly writeAccess: TransferWriteAccessService;

  constructor(
    private readonly transactionRepository: TransactionRepository,
    accountRepository: AccountRepository,
    accountShareRepository: AccountShareRepository,
  ) {
    this.writeAccess = new TransferWriteAccessService(
      accountRepository,
      accountShareRepository,
    );
  }

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

    await this.writeAccess.ensureCanWriteTo(
      command.destinationAccountId,
      command.userId,
      {
        notFound: 'Destination account not found',
        forbidden: 'Write access to the destination account is required',
      },
    );

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
}
