import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { Tag } from '../domain/tag.entity';
import { TagRepository } from '../domain/tag.repository.interface';

interface TagRow {
  id: string;
  account_id: string;
  name: string;
  color: string;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class SupabaseTagRepository implements TagRepository {
  constructor(
    @Inject('SUPABASE_CLIENT')
    private readonly supabase: SupabaseClient,
  ) {}

  async findAllByAccount(accountId: string): Promise<Tag[]> {
    const { data, error } = await this.supabase
      .from('tags')
      .select('*')
      .eq('account_id', accountId)
      .returns<TagRow[]>();

    if (error) throw new Error(error.message);

    return (data || []).map((row) => this.mapToDomain(row));
  }

  async findById(id: string): Promise<Tag | null> {
    const { data, error } = await this.supabase
      .from('tags')
      .select('*')
      .eq('id', id)
      .returns<TagRow>()
      .single();

    if (error) return null;

    return this.mapToDomain(data);
  }

  async save(tag: Tag): Promise<void> {
    const { error } = await this.supabase.from('tags').upsert({
      id: tag.id,
      account_id: tag.accountId,
      name: tag.name,
      color: tag.color,
      created_at: tag.createdAt.toISOString(),
      updated_at: tag.updatedAt.toISOString(),
    });

    if (error) throw new Error(error.message);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase.from('tags').delete().eq('id', id);

    if (error) throw new Error(error.message);
  }

  private mapToDomain(row: TagRow): Tag {
    return new Tag({
      id: row.id,
      accountId: row.account_id,
      name: row.name,
      color: row.color,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }
}
