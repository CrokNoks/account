import { Injectable } from '@nestjs/common';
import { TransactionRepository } from '../domain/transaction.repository.interface';
import { Transaction } from '../domain/transaction.entity';
import * as crypto from 'crypto';

export interface CreateTransferCommand {
  sourceAccountId: string;
  destinationAccountId: string;
  amount: bigint; // positive amount in cents
  date: Date;
  description: string;
}

@Injectable()
export class CreateTransferUseCase {
  constructor(private readonly transactionRepository: TransactionRepository) {}

  async execute(command: CreateTransferCommand): Promise<[Transaction, Transaction]> {
    if (command.amount <= BigInt(0)) {
      throw new Error('Transfer amount must be strictly positive');
    }
    if (command.sourceAccountId === command.destinationAccountId) {
      throw new Error('Source and destination accounts must be different');
    }

    const transferId = crypto.randomUUID();

    const sourceTransaction = Transaction.create({
      accountId: command.sourceAccountId,
      categoryId: null,
      date: command.date,
      description: command.description,
      amount: -command.amount,
      metadata: { transferId, type: 'transfer_out', relatedAccountId: command.destinationAccountId },
      reconciled: false,
      pending: false,
    });

    const destinationTransaction = Transaction.create({
      accountId: command.destinationAccountId,
      categoryId: null,
      date: command.date,
      description: command.description,
      amount: command.amount,
      metadata: { transferId, type: 'transfer_in', relatedAccountId: command.sourceAccountId },
      reconciled: false,
      pending: false,
    });

    await this.transactionRepository.save(sourceTransaction);
    await this.transactionRepository.save(destinationTransaction);

    return [sourceTransaction, destinationTransaction];
  }
}
