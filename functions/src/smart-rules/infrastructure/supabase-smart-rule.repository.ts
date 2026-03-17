import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SmartRule } from '../domain/smart-rule.entity';
import { SmartRuleRepository } from '../domain/smart-rule.repository.interface';

interface SmartRuleRow {
  id: string;
  account_id: string;
  pattern: string;
  category_id: string | null;
  tag_ids: string[];
  priority: number;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class SupabaseSmartRuleRepository implements SmartRuleRepository {
  constructor(
    @Inject('SUPABASE_CLIENT')
    private readonly supabase: SupabaseClient,
  ) {}

  async findAllByAccount(accountId: string): Promise<SmartRule[]> {
    const { data, error } = await this.supabase
      .from('smart_rules')
      .select('*')
      .eq('account_id', accountId)
      .order('priority', { ascending: false })
      .returns<SmartRuleRow[]>();

    if (error) throw new Error(error.message);
    return (data || []).map((row) => this.mapToDomain(row));
  }

  async findById(id: string): Promise<SmartRule | null> {
    const { data, error } = await this.supabase
      .from('smart_rules')
      .select('*')
      .eq('id', id)
      .maybeSingle<SmartRuleRow>();

    if (error) throw new Error(error.message);
    if (!data) return null;
    return this.mapToDomain(data);
  }

  async save(rule: SmartRule): Promise<void> {
    const { error } = await this.supabase.from('smart_rules').upsert({
      id: rule.id,
      account_id: rule.accountId,
      pattern: rule.pattern,
      category_id: rule.categoryId,
      tag_ids: rule.tagIds,
      priority: rule.priority,
      created_at: rule.createdAt.toISOString(),
      updated_at: rule.updatedAt.toISOString(),
    });

    if (error) throw new Error(error.message);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase.from('smart_rules').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }

  private mapToDomain(row: SmartRuleRow): SmartRule {
    return new SmartRule({
      id: row.id,
      accountId: row.account_id,
      pattern: row.pattern,
      categoryId: row.category_id,
      tagIds: row.tag_ids,
      priority: row.priority,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }
}
