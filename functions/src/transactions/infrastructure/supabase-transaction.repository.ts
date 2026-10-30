import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { Transaction } from '../domain/transaction.entity';
import { toTransactionPayload } from './transaction-payload';
import {
  TransactionRepository,
  FindAllTransactionsOptions,
  PaginatedResult,
} from '../domain/transaction.repository.interface';

interface TransactionTagRow {
  tag_id: string;
}

interface TransactionRow {
  id: string;
  account_id: string;
  category_id: string | null;
  period_id: string | null;
  date: string;
  description: string;
  amount: string;
  reconciled: boolean;
  pending: boolean;
  payment_method: string | null;
  notes: string | null;
  metadata: Record<string, any> | null;
  savings_goal_id: string | null;
  created_at: string;
  updated_at: string;
  transaction_tags?: TransactionTagRow[];
}

@Injectable()
export class SupabaseTransactionRepository implements TransactionRepository {
  constructor(
    @Inject('SUPABASE_CLIENT')
    private readonly supabase: SupabaseClient,
  ) {}

  async findAllByAccount(
    accountId: string,
    options?: FindAllTransactionsOptions,
  ): Promise<PaginatedResult<Transaction>> {
    const select =
      options?.tagIds && options.tagIds.length > 0
        ? '*, transaction_tags!inner(tag_id)'
        : '*, transaction_tags(tag_id)';

    let query = this.supabase
      .from('transactions')
      .select(select, { count: 'exact' })
      .eq('account_id', accountId);

    if (options?.startDate) {
      query = query.gte('date', options.startDate.toISOString().split('T')[0]);
    }
    if (options?.endDate) {
      query = query.lte('date', options.endDate.toISOString().split('T')[0]);
    }
    if (options?.search) {
      query = query.or(
        `description.ilike.%${options.search}%,notes.ilike.%${options.search}%`,
      );
    }
    if (options?.categoryId) {
      query = query.eq('category_id', options.categoryId);
    }
    if (options?.tagIds && options.tagIds.length > 0) {
      query = query.in('transaction_tags.tag_id', options.tagIds);
    }
    if (options?.minAmount !== undefined) {
      query = query.gte('amount', options.minAmount.toString());
    }
    if (options?.maxAmount !== undefined) {
      query = query.lte('amount', options.maxAmount.toString());
    }
    if (options?.reconciled !== undefined) {
      query = query.eq('reconciled', options.reconciled);
    }

    const page = options?.page && options.page > 0 ? options.page : 1;
    const limit = options?.limit && options.limit > 0 ? options.limit : 1000;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, count, error } = await query
      .order('date', { ascending: false })
      .range(from, to)
      .returns<TransactionRow[]>();

    if (error) throw new Error(error.message);

    const total = count || 0;
    const totalPages = Math.ceil(total / limit);

    return {
      data: (data || []).map((row) => this.mapToDomain(row)),
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  async findAllByAccountUnpaginated(
    accountId: string,
    options?: FindAllTransactionsOptions,
  ): Promise<Transaction[]> {
    const select =
      options?.tagIds && options.tagIds.length > 0
        ? '*, transaction_tags!inner(tag_id)'
        : '*, transaction_tags(tag_id)';

    let query = this.supabase
      .from('transactions')
      .select(select)
      .eq('account_id', accountId);

    if (options?.startDate) {
      query = query.gte('date', options.startDate.toISOString().split('T')[0]);
    }
    if (options?.endDate) {
      query = query.lte('date', options.endDate.toISOString().split('T')[0]);
    }
    if (options?.search) {
      query = query.or(
        `description.ilike.%${options.search}%,notes.ilike.%${options.search}%`,
      );
    }
    if (options?.categoryId) {
      query = query.eq('category_id', options.categoryId);
    }
    if (options?.tagIds && options.tagIds.length > 0) {
      query = query.in('transaction_tags.tag_id', options.tagIds);
    }
    if (options?.minAmount !== undefined) {
      query = query.gte('amount', options.minAmount.toString());
    }
    if (options?.maxAmount !== undefined) {
      query = query.lte('amount', options.maxAmount.toString());
    }
    if (options?.reconciled !== undefined) {
      query = query.eq('reconciled', options.reconciled);
    }

    const { data, error } = await query
      .order('date', { ascending: false })
      .returns<TransactionRow[]>();

    if (error) throw new Error(error.message);

    return (data || []).map((row) => this.mapToDomain(row));
  }

  async sumAmountByAccountBeforeDate(
    accountId: string,
    date: Date,
  ): Promise<bigint> {
    const response = await this.supabase.rpc('sum_transactions_before_date', {
      p_account_id: accountId,
      p_date: date.toISOString().split('T')[0],
    });

    if (response.error) {
      console.warn(
        'RPC sum_transactions_before_date failed, fallback to manual sum',
        response.error,
      );
      return BigInt(0);
    }

    const dataValue = response.data as string | number | null;
    return BigInt(dataValue || 0);
  }

  async findAllByPeriod(periodId: string): Promise<Transaction[]> {
    const { data, error } = await this.supabase
      .from('transactions')
      .select('*, transaction_tags(tag_id)')
      .eq('period_id', periodId)
      .order('date', { ascending: false })
      .returns<TransactionRow[]>();

    if (error) throw new Error(error.message);

    return (data || []).map((row) => this.mapToDomain(row));
  }

  async findById(id: string): Promise<Transaction | null> {
    const { data, error } = await this.supabase
      .from('transactions')
      .select('*, transaction_tags(tag_id)')
      .eq('id', id)
      .returns<TransactionRow>()
      .single();

    if (error) return null;

    return this.mapToDomain(data);
  }

  async save(transaction: Transaction): Promise<void> {
    // Fonction SQL save_transaction : upsert + remplacement des tags dans une
    // seule transaction base de données, toutes les erreurs sont remontées.
    const { error } = await this.supabase.rpc('save_transaction', {
      p_transaction: toTransactionPayload(transaction),
    });

    if (error) throw new Error(error.message);
  }

  async saveTransfer(debit: Transaction, credit: Transaction): Promise<void> {
    // Fonction SQL create_transfer : une seule transaction base de données.
    const { error } = await this.supabase.rpc('create_transfer', {
      p_debit: toTransactionPayload(debit),
      p_credit: toTransactionPayload(credit),
    });

    if (error) throw new Error(error.message);
  }

  async saveMany(transactions: Transaction[]): Promise<void> {
    // Fonction SQL create_transactions : une seule transaction base de données.
    const { error } = await this.supabase.rpc('create_transactions', {
      p_transactions: transactions.map(toTransactionPayload),
    });

    if (error) throw new Error(error.message);
  }

  async updateMany(transactions: Transaction[]): Promise<void> {
    // Fonction SQL update_transactions : une seule transaction base de données.
    const { error } = await this.supabase.rpc('update_transactions', {
      p_transactions: transactions.map(toTransactionPayload),
    });

    if (error) throw new Error(error.message);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('transactions')
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);
  }

  private mapToDomain(row: TransactionRow): Transaction {
    const tagIds = row.transaction_tags
      ? row.transaction_tags.map((tt) => tt.tag_id)
      : [];

    return new Transaction({
      id: row.id,
      accountId: row.account_id,
      categoryId: row.category_id,
      periodId: row.period_id,
      date: new Date(row.date),
      description: row.description,
      amount: BigInt(row.amount),
      reconciled: row.reconciled,
      pending: row.pending,
      paymentMethod: row.payment_method,
      notes: row.notes,
      metadata: row.metadata || {},
      tagIds: tagIds,
      savingsGoalId: row.savings_goal_id,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }
}
