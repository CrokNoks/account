import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { BudgetRepository, CategoryStats } from '../domain/budget.repository.interface';
import { BudgetInstance } from '../domain/budget-instance.entity';

@Injectable()
export class SupabaseBudgetRepository implements BudgetRepository {
  constructor(
    @Inject('SUPABASE_CLIENT')
    private readonly supabase: SupabaseClient,
  ) {}

  async findAllByPeriod(periodId: string): Promise<BudgetInstance[]> {
    const { data, error } = await this.supabase
      .from('budget_instances')
      .select('*')
      .eq('period_id', periodId);

    if (error) throw new Error(error.message);

    return (data || []).map(row => this.mapToDomain(row));
  }

  async findById(id: string): Promise<BudgetInstance | null> {
    const { data, error } = await this.supabase
      .from('budget_instances')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return null;

    return this.mapToDomain(data);
  }

  async save(instance: BudgetInstance): Promise<void> {
    const { error } = await this.supabase
      .from('budget_instances')
      .upsert({
        id: instance.id,
        period_id: instance.periodId,
        category_id: instance.categoryId,
        amount_allocated: instance.amountAllocated.toString(),
        created_at: instance.createdAt.toISOString(),
        updated_at: instance.updatedAt.toISOString(),
      });

    if (error) throw new Error(error.message);
  }

  async saveBulk(instances: BudgetInstance[]): Promise<void> {
    const { error } = await this.supabase
      .from('budget_instances')
      .insert(instances.map(i => ({
        id: i.id,
        period_id: i.periodId,
        category_id: i.categoryId,
        amount_allocated: i.amountAllocated.toString(),
        created_at: i.createdAt.toISOString(),
        updated_at: i.updatedAt.toISOString(),
      })));

    if (error) throw new Error(error.message);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('budget_instances')
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);
  }

  async deleteAllByPeriod(periodId: string): Promise<void> {
    const { error } = await this.supabase
      .from('budget_instances')
      .delete()
      .eq('period_id', periodId);

    if (error) throw new Error(error.message);
  }

  async getHistoricalStatsByAccount(accountId: string): Promise<CategoryStats[]> {
    /**
     * PostgreSQL specific query:
     * Calculates stats based on past transaction history grouped by period.
     */
    const { data, error } = await this.supabase
      .rpc('get_category_historical_stats', { p_account_id: accountId });

    if (error) {
      console.warn('RPC get_category_historical_stats failed, falling back to empty stats', error);
      return [];
    }

    return (data || []).map(row => ({
      categoryId: row.category_id,
      minReal: BigInt(row.min_real),
      maxReal: BigInt(row.max_real),
      avgReal: BigInt(Math.round(row.avg_real)),
    }));
  }

  private mapToDomain(row: any): BudgetInstance {
    return new BudgetInstance({
      id: row.id,
      periodId: row.period_id,
      categoryId: row.category_id,
      amountAllocated: BigInt(row.amount_allocated),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }
}
