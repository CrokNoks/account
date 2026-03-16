import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { Category, CategoryType } from '../domain/category.entity';
import { CategoryRepository } from '../domain/category.repository.interface';

interface CategoryRow {
  id: string;
  name: string;
  description: string | null;
  color: string;
  type: string;
  account_id: string;
  user_id: string;
  budget: string | null;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class SupabaseCategoryRepository implements CategoryRepository {
  constructor(
    @Inject('SUPABASE_CLIENT')
    private readonly supabase: SupabaseClient,
  ) {}

  async findAllByAccount(accountId: string): Promise<Category[]> {
    const { data, error } = await this.supabase
      .from('categories')
      .select('*')
      .eq('account_id', accountId)
      .returns<CategoryRow[]>();

    if (error) throw new Error(error.message);

    return (data || []).map((row) => this.mapToDomain(row));
  }

  async findById(id: string): Promise<Category | null> {
    const { data, error } = await this.supabase
      .from('categories')
      .select('*')
      .eq('id', id)
      .returns<CategoryRow>()
      .single();

    if (error) return null;

    return this.mapToDomain(data);
  }

  async save(category: Category): Promise<void> {
    const { error } = await this.supabase.from('categories').upsert({
      id: category.id,
      name: category.name,
      description: category.description,
      color: category.color,
      type: category.type,
      account_id: category.accountId,
      budget: category.budget ? category.budget.toString() : null,
      created_at: category.createdAt.toISOString(),
      updated_at: category.updatedAt.toISOString(),
    });

    if (error) throw new Error(error.message);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('categories')
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);
  }

  private mapToDomain(row: CategoryRow): Category {
    return new Category({
      id: row.id,
      name: row.name,
      description: row.description,
      color: row.color,
      type: row.type as CategoryType,
      accountId: row.account_id,
      budget: row.budget ? BigInt(row.budget) : null,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }
}
