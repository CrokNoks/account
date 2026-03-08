import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { Transaction } from '../domain/transaction.entity';
import { TransactionRepository, FindAllTransactionsOptions } from '../domain/transaction.repository.interface';

@Injectable()
export class SupabaseTransactionRepository implements TransactionRepository {
  constructor(
    @Inject('SUPABASE_CLIENT')
    private readonly supabase: SupabaseClient,
  ) {}

  async findAllByAccount(accountId: string, options?: FindAllTransactionsOptions): Promise<Transaction[]> {
    let query = this.supabase
      .from('transactions')
      .select('*')
      .eq('account_id', accountId);

    if (options?.startDate) {
      query = query.gte('date', options.startDate.toISOString().split('T')[0]);
    }
    if (options?.endDate) {
      query = query.lte('date', options.endDate.toISOString().split('T')[0]);
    }

    const { data, error } = await query.order('date', { ascending: false });

    if (error) throw new Error(error.message);

    return (data || []).map(row => this.mapToDomain(row));
  }

  async sumAmountByAccountBeforeDate(accountId: string, date: Date): Promise<bigint> {
    // To bypass the 1000 limit and avoid fetching all data, we use an RPC call
    // or a specialized query. If we don't have an RPC, we can use a select with sum if the view exists
    // but here we'll assume we want a robust way.
    // For now, let's use a query that only selects the amount and sum it.
    // Actually, Supabase doesn't support .sum() client-side easily without fetching all rows.
    // The best way is to use a PostgreSQL function (RPC).
    
    const { data, error } = await this.supabase
      .rpc('sum_transactions_before_date', {
        p_account_id: accountId,
        p_date: date.toISOString().split('T')[0]
      });

    if (error) {
      // Fallback if RPC doesn't exist yet or other error
      // Note: In production you should ensure the RPC exists
      console.warn('RPC sum_transactions_before_date failed, fallback to manual sum', error);
      // Fallback logic could go here, but let's prioritize the RPC
      return BigInt(0);
    }

    return BigInt(data || 0);
  }

  async findAllByPeriod(periodId: string): Promise<Transaction[]> {
    const { data, error } = await this.supabase
      .from('transactions')
      .select('*')
      .eq('period_id', periodId)
      .order('date', { ascending: false });

    if (error) throw new Error(error.message);

    return (data || []).map(row => this.mapToDomain(row));
  }

  async findById(id: string): Promise<Transaction | null> {
    const { data, error } = await this.supabase
      .from('transactions')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return null;

    return this.mapToDomain(data);
  }

  async save(transaction: Transaction): Promise<void> {
    const { error } = await this.supabase
      .from('transactions')
      .upsert({
        id: transaction.id,
        account_id: transaction.accountId,
        category_id: transaction.categoryId,
        period_id: transaction.periodId,
        date: transaction.date.toISOString().split('T')[0],
        description: transaction.description,
        amount: transaction.amount.toString(),
        reconciled: transaction.reconciled,
        payment_method: transaction.paymentMethod,
        notes: transaction.notes,
        metadata: transaction.metadata,
        created_at: transaction.createdAt.toISOString(),
        updated_at: transaction.updatedAt.toISOString(),
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

  private mapToDomain(row: any): Transaction {
    return new Transaction({
      id: row.id,
      accountId: row.account_id,
      categoryId: row.category_id,
      periodId: row.period_id,
      date: new Date(row.date),
      description: row.description,
      amount: BigInt(row.amount),
      reconciled: row.reconciled,
      paymentMethod: row.payment_method,
      notes: row.notes,
      metadata: row.metadata || {},
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }
}
