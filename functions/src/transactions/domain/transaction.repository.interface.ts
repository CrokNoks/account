import { Transaction } from './transaction.entity';

export interface FindAllTransactionsOptions {
  startDate?: Date;
  endDate?: Date;
}

export abstract class TransactionRepository {
  abstract findAllByAccount(
    accountId: string,
    options?: FindAllTransactionsOptions,
  ): Promise<Transaction[]>;
  abstract findAllByPeriod(periodId: string): Promise<Transaction[]>;
  abstract findById(id: string): Promise<Transaction | null>;
  abstract save(transaction: Transaction): Promise<void>;
  abstract delete(id: string): Promise<void>;
  abstract sumAmountByAccountBeforeDate(
    accountId: string,
    date: Date,
  ): Promise<bigint>;
}
