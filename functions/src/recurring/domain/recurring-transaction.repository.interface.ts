import { RecurringTransaction } from './recurring-transaction.entity';

export abstract class RecurringTransactionRepository {
  abstract findAllByAccount(accountId: string): Promise<RecurringTransaction[]>;
  abstract findById(id: string): Promise<RecurringTransaction | null>;
  abstract save(transaction: RecurringTransaction): Promise<void>;
  abstract delete(id: string): Promise<void>;
}
