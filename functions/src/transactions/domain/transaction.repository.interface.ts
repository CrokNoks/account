import { Transaction } from './transaction.entity';
import { WindowPeriod } from '../../reporting/domain/period-window';

export interface FindAllTransactionsOptions {
  startDate?: Date;
  endDate?: Date;
  /** Fenêtre d'une période (règle `isInPeriodWindow`) ; la liste paginée l'applique en plus des autres filtres. */
  periodWindow?: WindowPeriod;
  search?: string;
  categoryId?: string;
  tagIds?: string[];
  ids?: string[];
  minAmount?: bigint;
  maxAmount?: bigint;
  reconciled?: boolean;
  pending?: boolean;
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

export interface BalanceStarts {
  all: bigint;
  reconciled: bigint;
  nonPending: bigint;
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
  /**
   * Lignes (avec leurs tags) d'un compte portant ce `metadata.transferId`, lues
   * avec les droits de l'appelant (RLS) : un compte invisible ressemble à un orphelin.
   */
  abstract findTransferSides(
    transferId: string,
    accountId: string,
  ): Promise<Transaction[]>;
  /** Renvoie la ligne telle qu'enregistrée (periodId posé par le trigger inclus). */
  abstract save(transaction: Transaction): Promise<Transaction>;
  /**
   * Enregistre le débit et le crédit d'un virement dans une seule transaction
   * base de données : les deux lignes sont écrites, ou aucune.
   */
  abstract saveTransfer(
    debit: Transaction,
    credit: Transaction,
  ): Promise<[Transaction, Transaction]>;
  /**
   * Enregistre plusieurs nouvelles transactions (et leurs tags) dans une seule
   * transaction base de données : toutes sont écrites, ou aucune.
   */
  abstract saveMany(transactions: Transaction[]): Promise<Transaction[]>;
  /**
   * Modifie plusieurs transactions existantes (et remplace leurs tags) dans une
   * seule transaction base de données : toutes sont modifiées, ou aucune. Une
   * transaction inexistante fait tout échouer (aucune n'est créée).
   */
  abstract updateMany(transactions: Transaction[]): Promise<void>;
  abstract delete(id: string): Promise<void>;
  /**
   * Supprime plusieurs transactions en une seule requête (donc atomique : toutes
   * ou aucune ; la RLS et les triggers s'appliquent ligne par ligne).
   */
  abstract deleteMany(ids: string[]): Promise<void>;
  abstract sumAmountByAccountBeforeDate(
    accountId: string,
    date: Date,
  ): Promise<bigint>;
  /**
   * Trois sommes des transactions datées strictement avant `date`, en un appel :
   * toutes, pointées seules, non `pending` (départs de « En banque », « À venir » et du prévu).
   * Lève si la base échoue ou ne répond pas : jamais un départ à 0.
   */
  abstract sumAmountsBeforeDateByBalance(
    accountId: string,
    date: Date,
  ): Promise<BalanceStarts>;
}
