import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import {
  BudgetRepository,
  CategoryStats,
} from '../domain/budget.repository.interface';
import { ConflictError } from '../../shared/domain/errors';
import { BudgetInstance } from '../domain/budget-instance.entity';
import { toBudgetPayload } from './budget-payload';

interface BudgetInstanceRow {
  id: string;
  period_id: string;
  category_id: string;
  amount_allocated: string;
  created_at: string;
  updated_at: string;
}

interface CategoryStatsRow {
  category_id: string;
  min_real: string;
  max_real: string;
  avg_real: number;
}

/** Code Postgres d'une violation de contrainte d'unicité. */
const UNIQUE_VIOLATION = '23505';

const DUPLICATE_BUDGET =
  'A budget already exists for this category in this period';

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
      .eq('period_id', periodId)
      .returns<BudgetInstanceRow[]>();

    if (error) throw new Error(error.message);

    return (data || []).map((row) => this.mapToDomain(row));
  }

  async findById(id: string): Promise<BudgetInstance | null> {
    const { data, error } = await this.supabase
      .from('budget_instances')
      .select('*')
      .eq('id', id)
      .returns<BudgetInstanceRow>()
      .single();

    if (error) return null;

    return this.mapToDomain(data);
  }

  async save(instance: BudgetInstance): Promise<void> {
    const { error } = await this.supabase.from('budget_instances').upsert({
      id: instance.id,
      period_id: instance.periodId,
      category_id: instance.categoryId,
      amount_allocated: instance.amountAllocated.toString(),
      created_at: instance.createdAt.toISOString(),
      updated_at: instance.updatedAt.toISOString(),
    });

    // UNIQUE(period_id, category_id) : budget_instances_period_id_category_id_key
    if (error?.code === UNIQUE_VIOLATION)
      throw new ConflictError(DUPLICATE_BUDGET);
    if (error) throw new Error(error.message);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('budget_instances')
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);
  }

  async replaceForPeriod(
    periodId: string,
    instances: BudgetInstance[],
  ): Promise<void> {
    // Fonction SQL replace_period_budgets : suppression + insertion dans une seule transaction.
    const { error } = await this.supabase.rpc('replace_period_budgets', {
      p_period_id: periodId,
      p_budgets: instances.map(toBudgetPayload),
    });

    if (error?.code === UNIQUE_VIOLATION)
      throw new ConflictError(DUPLICATE_BUDGET);
    if (error) throw new Error(error.message);
  }

  async getHistoricalStatsByAccount(
    accountId: string,
  ): Promise<CategoryStats[]> {
    /**
     * PostgreSQL specific query:
     * Calculates stats based on past transaction history grouped by period.
     */
    const { data, error } = await this.supabase
      .rpc('get_category_historical_stats', { p_account_id: accountId })
      .returns<CategoryStatsRow[]>();

    if (error) {
      console.warn(
        'RPC get_category_historical_stats failed, falling back to empty stats',
        error,
      );
      return [];
    }

    const statsData = data as CategoryStatsRow[] | null;

    return (statsData || []).map((row) => ({
      categoryId: row.category_id,
      minReal: BigInt(row.min_real),
      maxReal: BigInt(row.max_real),
      avgReal: BigInt(Math.round(row.avg_real)),
    }));
  }

  private mapToDomain(row: BudgetInstanceRow): BudgetInstance {
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
