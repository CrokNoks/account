import { Transaction } from './transaction.entity';

export interface FindAllTransactionsOptions {
  startDate?: Date;
  endDate?: Date;
  search?: string;
  categoryId?: string;
  tagIds?: string[];
  minAmount?: bigint;
  maxAmount?: bigint;
  reconciled?: boolean;
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export abstract class TransactionRepository {
  abstract findAllByAccount(
    accountId: string,
    options?: FindAllTransactionsOptions,
  ): Promise<PaginatedResult<Transaction>>;
  abstract findAllByAccountUnpaginated(
    accountId: string,
    options?: FindAllTransactionsOptions,
  ): Promise<Transaction[]>;
  abstract findAllByPeriod(periodId: string): Promise<Transaction[]>;
  abstract findById(id: string): Promise<Transaction | null>;
  abstract save(transaction: Transaction): Promise<void>;
  /**
   * Enregistre le débit et le crédit d'un virement dans une seule transaction
   * base de données : les deux lignes sont écrites, ou aucune.
   */
  abstract saveTransfer(debit: Transaction, credit: Transaction): Promise<void>;
  /**
   * Enregistre plusieurs nouvelles transactions (et leurs tags) dans une seule
   * transaction base de données : toutes sont écrites, ou aucune.
   */
  abstract saveMany(transactions: Transaction[]): Promise<void>;
  abstract delete(id: string): Promise<void>;
  abstract sumAmountByAccountBeforeDate(
    accountId: string,
    date: Date,
  ): Promise<bigint>;
}
