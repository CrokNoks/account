import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { Period } from '../domain/period.entity';
import {
  PeriodDeletionPlan,
  PeriodDeletionResult,
  PeriodRepository,
  PeriodSwitchWrite,
  PeriodSwitchWriteResult,
} from '../domain/period.repository.interface';
import { BudgetInstance } from '../../budgets/domain/budget-instance.entity';
import { toBudgetPayload } from '../../budgets/infrastructure/budget-payload';
import { Transaction } from '../../transactions/domain/transaction.entity';
import { toTransactionPayload } from '../../transactions/infrastructure/transaction-payload';
import { toDomainError } from '../../shared/infrastructure/supabase-error';

interface PeriodRow {
  id: string;
  account_id: string;
  start_date: string;
  end_date: string | null;
  estimated_end_date: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** Contrainte d'exclusion periods_no_overlap (23P01). */
const PERIOD_OVERLAP = 'Period overlaps an existing period';
/** Index unique partiel periods_one_active_per_account (23505). */
const ANOTHER_ACTIVE = 'Another period is already active for this account';
const BUDGET_DUPLICATE =
  'A budget already exists for this category in this period';

/** Message 409 selon le code ET la contrainte nommée dans l'erreur. */
function periodConflict(error: {
  code?: string;
  message: string;
}): string | undefined {
  if (
    error.code === '23505' &&
    error.message.includes('periods_one_active_per_account')
  )
    return ANOTHER_ACTIVE;
  if (error.code === '23P01') return PERIOD_OVERLAP;
  if (error.message.includes('budget_instances')) return BUDGET_DUPLICATE;
  return undefined;
}

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

    if (error) throw toDomainError(error, { conflict: periodConflict(error) });
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

    // 23505 : periods_one_active_per_account ou budget_instances_period_id_category_id_key
    if (error) throw toDomainError(error, { conflict: periodConflict(error) });
  }

  async applyPeriodSwitches(
    accountId: string,
    expectedActiveId: string,
    switches: PeriodSwitchWrite[],
    transactions: Transaction[],
    generated: Transaction[],
    removePendingIds: string[] = [],
    update = false,
  ): Promise<PeriodSwitchWriteResult> {
    const day = (d: Date) => d.toISOString().split('T')[0];
    // Fonction SQL apply_period_switches : une seule transaction base de données,
    // verrou de ligne sur l'active (déclenchements concurrents sérialisés).
    const { data, error } = (await this.supabase.rpc('apply_period_switches', {
      p_account_id: accountId,
      p_expected_active_id: expectedActiveId,
      p_switches: switches.map((s) => ({
        closed_id: s.closedId,
        close_end: day(s.closeEnd),
        closed_prev_end: s.closedPrevEnd ? day(s.closedPrevEnd) : null,
        opened: {
          id: s.opened.id,
          account_id: s.opened.accountId,
          start_date: day(s.opened.startDate),
          end_date: s.opened.endDate ? day(s.opened.endDate) : null,
          created_at: s.opened.createdAt.toISOString(),
          updated_at: s.opened.updatedAt.toISOString(),
        },
        budgets: s.budgets.map(toBudgetPayload),
      })),
      p_transactions: transactions.map(toTransactionPayload),
      p_generated: generated.map(toTransactionPayload),
      p_remove_pending_ids: removePendingIds,
      p_update: update,
    })) as {
      data: { switched?: boolean; removed?: number } | null;
      error: { code?: string; message: string } | null;
    };

    // 23505 / 23P01 : une autre période active, un chevauchement, un budget en doublon
    // (409) ; 42501 : lecture seule (403). Dans tous les cas rien n'est écrit.
    // P0002 : en mode modification, une transaction du lot a disparu (rien n'est écrit).
    if (error)
      throw toDomainError(error, {
        conflict: periodConflict(error),
        notFound: 'Transaction not found',
      });

    return {
      switched: data?.switched === true,
      removed: data?.removed ?? 0,
    };
  }

  async delete(id: string): Promise<PeriodDeletionResult> {
    // Fonction SQL delete_period_clean : une seule transaction (pending récurrentes, rattachement,
    // période, réouverture). 42501 : lecture seule (403) ; P0002 : inconnue (404) ; 23505/23P01 : 409.
    const { data, error } = (await this.supabase.rpc('delete_period_clean', {
      p_period_id: id,
    })) as {
      data: PeriodDeletionResult | null;
      error: { code?: string; message: string } | null;
    };

    if (error)
      throw toDomainError(error, {
        conflict: periodConflict(error),
        notFound: 'Period not found',
      });

    // Une réponse vide ne dit pas ce qui a été supprimé : jamais de zéros inventés.
    if (!data)
      throw new Error('delete_period_clean returned an empty response');

    return {
      removedPending: data.removedPending ?? 0,
      keptTransactions: data.keptTransactions ?? 0,
      reopenedPeriodId: data.reopenedPeriodId ?? null,
      origin: data.origin === 'trigger' ? 'trigger' : 'manual',
    };
  }

  async previewDelete(id: string): Promise<PeriodDeletionPlan> {
    const { data, error } = (await this.supabase.rpc('preview_delete_period', {
      p_period_id: id,
    })) as {
      data: {
        removedPending?: number;
        keptTransactions?: number;
        reopenId?: string | null;
        reopenStart?: string | null;
        reopenEnd?: string | null;
        origin?: string;
      } | null;
      error: { code?: string; message: string } | null;
    };

    if (error) throw toDomainError(error, { notFound: 'Period not found' });

    return {
      removedPending: data?.removedPending ?? 0,
      keptTransactions: data?.keptTransactions ?? 0,
      reopen:
        data?.reopenId && data.reopenStart
          ? {
              periodId: data.reopenId,
              startDate: data.reopenStart,
              endDate: data.reopenEnd ?? null,
            }
          : null,
      origin: data?.origin === 'trigger' ? 'trigger' : 'manual',
    };
  }

  private mapToDomain(row: PeriodRow): Period {
    return new Period({
      id: row.id,
      accountId: row.account_id,
      startDate: new Date(row.start_date),
      endDate: row.end_date ? new Date(row.end_date) : null,
      estimatedEndDate: row.estimated_end_date
        ? new Date(row.estimated_end_date)
        : null,
      isActive: row.is_active,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }
}
