import { Injectable } from '@nestjs/common';
import {
  TransactionRepository,
  FindAllTransactionsOptions,
  PaginatedResult,
} from '../domain/transaction.repository.interface';
import { Transaction } from '../domain/transaction.entity';

@Injectable()
export class GetTransactionsByAccountUseCase {
  constructor(private readonly transactionRepository: TransactionRepository) {}

  async execute(
    accountId: string,
    options?: FindAllTransactionsOptions,
  ): Promise<PaginatedResult<Transaction>> {
    return this.transactionRepository.findAllByAccount(accountId, options);
  }
}
