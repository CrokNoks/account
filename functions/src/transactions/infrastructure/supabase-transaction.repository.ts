import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { Transaction } from '../domain/transaction.entity';
import {
  TransactionRepository,
  FindAllTransactionsOptions,
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
  ): Promise<Transaction[]> {
    let query = this.supabase
      .from('transactions')
      .select('*, transaction_tags(tag_id)')
      .eq('account_id', accountId);

    if (options?.startDate) {
      query = query.gte('date', options.startDate.toISOString().split('T')[0]);
    }
    if (options?.endDate) {
      query = query.lte('date', options.endDate.toISOString().split('T')[0]);
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
    const { error } = await this.supabase.from('transactions').upsert({
      id: transaction.id,
      account_id: transaction.accountId,
      category_id: transaction.categoryId,
      period_id: transaction.periodId,
      date: transaction.date.toISOString().split('T')[0],
      description: transaction.description,
      amount: transaction.amount.toString(),
      reconciled: transaction.reconciled,
      pending: transaction.pending,
      payment_method: transaction.paymentMethod,
      notes: transaction.notes,
      metadata: transaction.metadata || {},
      created_at: transaction.createdAt.toISOString(),
      updated_at: transaction.updatedAt.toISOString(),
    });

    if (error) throw new Error(error.message);

    // Update tags
    // First, delete existing tags for this transaction
    await this.supabase
      .from('transaction_tags')
      .delete()
      .eq('transaction_id', transaction.id);

    // Then, insert new tags
    if (transaction.tagIds && transaction.tagIds.length > 0) {
      const tagInserts = transaction.tagIds.map((tagId) => ({
        transaction_id: transaction.id,
        tag_id: tagId,
      }));

      const { error: tagsError } = await this.supabase
        .from('transaction_tags')
        .insert(tagInserts);

      if (tagsError) throw new Error(tagsError.message);
    }
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
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }
}
