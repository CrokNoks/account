import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { Transaction } from '../domain/transaction.entity';
import { TransactionRepository } from '../domain/transaction.repository.interface';

@Injectable()
export class SupabaseTransactionRepository implements TransactionRepository {
  constructor(
    @Inject('SUPABASE_CLIENT')
    private readonly supabase: SupabaseClient,
  ) {}

  async findAllByAccount(accountId: string): Promise<Transaction[]> {
    const { data, error } = await this.supabase
      .from('transactions')
      .select('*')
      .eq('account_id', accountId)
      .order('date', { ascending: false });

    if (error) throw new Error(error.message);

    return (data || []).map(row => this.mapToDomain(row));
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
