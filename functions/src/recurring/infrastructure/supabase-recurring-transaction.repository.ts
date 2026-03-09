import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { RecurringTransaction } from '../domain/recurring-transaction.entity';
import { RecurringTransactionRepository } from '../domain/recurring-transaction.repository.interface';

@Injectable()
export class SupabaseRecurringTransactionRepository implements RecurringTransactionRepository {
  constructor(
    @Inject('SUPABASE_CLIENT')
    private readonly supabase: SupabaseClient,
  ) {}

  async findAllByAccount(accountId: string): Promise<RecurringTransaction[]> {
    const { data, error } = await this.supabase
      .from('recurring_transactions')
      .select('*')
      .eq('account_id', accountId)
      .order('day_of_month', { ascending: true });

    if (error) throw new Error(error.message);

    return (data || []).map(row => this.mapToDomain(row));
  }

  async findById(id: string): Promise<RecurringTransaction | null> {
    const { data, error } = await this.supabase
      .from('recurring_transactions')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return null;
    return this.mapToDomain(data);
  }

  async save(transaction: RecurringTransaction): Promise<void> {
    const { error } = await this.supabase
      .from('recurring_transactions')
      .upsert({
        id: transaction.id,
        account_id: transaction.accountId,
        category_id: transaction.categoryId,
        description: transaction.description,
        amount: transaction.amount.toString(),
        day_of_month: transaction.dayOfMonth,
        created_at: transaction.createdAt.toISOString(),
        updated_at: transaction.updatedAt.toISOString(),
      });

    if (error) throw new Error(error.message);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('recurring_transactions')
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);
  }

  private mapToDomain(row: any): RecurringTransaction {
    return new RecurringTransaction({
      id: row.id,
      accountId: row.account_id,
      categoryId: row.category_id,
      description: row.description,
      amount: BigInt(row.amount),
      dayOfMonth: row.day_of_month,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }
}
