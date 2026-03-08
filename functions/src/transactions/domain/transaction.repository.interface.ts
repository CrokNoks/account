import { Transaction } from './transaction.entity';

export abstract class TransactionRepository {
  abstract findAllByAccount(accountId: string): Promise<Transaction[]>;
  abstract findAllByPeriod(periodId: string): Promise<Transaction[]>;
  abstract findById(id: string): Promise<Transaction | null>;
  abstract save(transaction: Transaction): Promise<void>;
  abstract delete(id: string): Promise<void>;
}
