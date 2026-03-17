import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SavingsGoal } from '../domain/savings-goal.entity';
import { SavingsGoalRepository } from '../domain/savings-goal.repository.interface';

interface SavingsGoalRow {
  id: string;
  account_id: string;
  name: string;
  target_amount: string;
  current_amount: string;
  deadline: string | null;
  color: string;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class SupabaseSavingsGoalRepository implements SavingsGoalRepository {
  constructor(
    @Inject('SUPABASE_CLIENT')
    private readonly supabase: SupabaseClient,
  ) {}

  async findAllByAccount(accountId: string): Promise<SavingsGoal[]> {
    const { data, error } = await this.supabase
      .from('savings_goals')
      .select('*')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false })
      .returns<SavingsGoalRow[]>();

    if (error) throw new Error(error.message);
    return (data || []).map((row) => this.mapToDomain(row));
  }

  async findById(id: string): Promise<SavingsGoal | null> {
    const { data, error } = await this.supabase
      .from('savings_goals')
      .select('*')
      .eq('id', id)
      .maybeSingle<SavingsGoalRow>();

    if (error) throw new Error(error.message);
    if (!data) return null;
    return this.mapToDomain(data);
  }

  async save(goal: SavingsGoal): Promise<void> {
    const { error } = await this.supabase.from('savings_goals').upsert({
      id: goal.id,
      account_id: goal.accountId,
      name: goal.name,
      target_amount: goal.targetAmount.toString(),
      current_amount: goal.currentAmount.toString(),
      deadline: goal.deadline ? goal.deadline.toISOString().split('T')[0] : null,
      color: goal.color,
      created_at: goal.createdAt.toISOString(),
      updated_at: goal.updatedAt.toISOString(),
    });

    if (error) throw new Error(error.message);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase.from('savings_goals').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }

  private mapToDomain(row: SavingsGoalRow): SavingsGoal {
    return new SavingsGoal({
      id: row.id,
      accountId: row.account_id,
      name: row.name,
      targetAmount: BigInt(row.target_amount),
      currentAmount: BigInt(row.current_amount),
      deadline: row.deadline ? new Date(row.deadline) : null,
      color: row.color,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }
}
