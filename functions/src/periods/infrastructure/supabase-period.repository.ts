import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { Period } from '../domain/period.entity';
import { PeriodRepository } from '../domain/period.repository.interface';
import { BudgetInstance } from '../../budgets/domain/budget-instance.entity';
import { toBudgetPayload } from '../../budgets/infrastructure/budget-payload';
import { Transaction } from '../../transactions/domain/transaction.entity';
import { toTransactionPayload } from '../../transactions/infrastructure/transaction-payload';
import { toDomainError } from '../../shared/infrastructure/supabase-error';

interface PeriodRow {
  id: string;
  account_id: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** Code Postgres d'une violation de contrainte d'unicité. */

@Injectable()
export class SupabasePeriodRepository implements PeriodRepository {
  constructor(
    @Inject('SUPABASE_CLIENT')
    private readonly supabase: SupabaseClient,
  ) {}

  async findById(id: string): Promise<Period | null> {
    const { data, error } = await this.supabase
      .from('periods')
      .select('*')
      .eq('id', id)
      .returns<PeriodRow>()
      .single();

    if (error) return null;

    return this.mapToDomain(data);
  }

  async findLastByAccount(accountId: string): Promise<Period | null> {
    const { data, error } = await this.supabase
      .from('periods')
      .select('*')
      .eq('account_id', accountId)
      .order('end_date', { ascending: false })
      .limit(1)
      .returns<PeriodRow>()
      .maybeSingle();

    if (error) return null;
    if (!data) return null;

    return this.mapToDomain(data);
  }

  async findAllByAccount(accountId: string): Promise<Period[]> {
    const { data, error } = await this.supabase
      .from('periods')
      .select('*')
      .eq('account_id', accountId)
      .order('start_date', { ascending: false })
      .returns<PeriodRow[]>();

    if (error) throw new Error(error.message);

    return (data || []).map((row) => this.mapToDomain(row));
  }

  async save(period: Period): Promise<void> {
    const { error } = await this.supabase.from('periods').upsert({
      id: period.id,
      account_id: period.accountId,
      start_date: period.startDate.toISOString().split('T')[0],
      end_date: period.endDate
        ? period.endDate.toISOString().split('T')[0]
        : null,
      is_active: period.isActive,
      created_at: period.createdAt.toISOString(),
      updated_at: period.updatedAt.toISOString(),
    });

    if (error) throw toDomainError(error);
  }

  async createWithBudgets(
    period: Period,
    budgets: BudgetInstance[],
    transactions: Transaction[],
  ): Promise<void> {
    // Fonction SQL create_period_with_budgets : une seule transaction base de données.
    const { error } = await this.supabase.rpc('create_period_with_budgets', {
      p_period: {
        id: period.id,
        account_id: period.accountId,
        start_date: period.startDate.toISOString().split('T')[0],
        end_date: period.endDate
          ? period.endDate.toISOString().split('T')[0]
          : null,
        is_active: period.isActive,
        created_at: period.createdAt.toISOString(),
        updated_at: period.updatedAt.toISOString(),
      },
      p_budgets: budgets.map(toBudgetPayload),
      p_transactions: transactions.map(toTransactionPayload),
    });

    // UNIQUE(period_id, category_id) : budget_instances_period_id_category_id_key
    if (error)
      throw toDomainError(error, {
        conflict: error.message.includes('budget_instances')
          ? 'A budget already exists for this category in this period'
          : undefined,
      });
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase.from('periods').delete().eq('id', id);

    if (error) throw toDomainError(error);
  }

  private mapToDomain(row: PeriodRow): Period {
    return new Period({
      id: row.id,
      accountId: row.account_id,
      startDate: new Date(row.start_date),
      endDate: row.end_date ? new Date(row.end_date) : null,
      isActive: row.is_active,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }
}
