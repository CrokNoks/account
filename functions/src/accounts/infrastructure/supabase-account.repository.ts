import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { AccountRepository } from '../domain/account.repository.interface';
import { Account } from '../domain/account.entity';

interface AccountRow {
  id: string;
  name: string;
  owner_id: string;
  description: string | null;
  initial_balance: string;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class SupabaseAccountRepository extends AccountRepository {
  constructor(
    @Inject('SUPABASE_CLIENT')
    private readonly supabase: SupabaseClient,
  ) {
    super();
  }

  async save(account: Account): Promise<void> {
    const { error } = await this.supabase.from('accounts').upsert({
      id: account.id,
      name: account.name,
      owner_id: account.ownerId,
      description: account.description,
      initial_balance: account.initialBalance.toString(), // Convert to string for BIGINT
      updated_at: account.updatedAt.toISOString(),
    });

    if (error) {
      throw new Error(`Failed to save account: ${error.message}`);
    }
  }

  async findAllForUser(): Promise<Account[]> {
    // We rely on RLS (Row Level Security) which is already configured in Supabase
    // to return only the accounts the user has access to (owner or shared).
    const { data, error } = await this.supabase
      .from('accounts')
      .select('*')
      .returns<AccountRow[]>();

    if (error) {
      throw new Error(`Failed to fetch accounts: ${error.message}`);
    }

    return (data || []).map((row) => this.mapToDomain(row));
  }

  async findById(id: string): Promise<Account | null> {
    const { data, error } = await this.supabase
      .from('accounts')
      .select('*')
      .eq('id', id)
      .returns<AccountRow>()
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // No rows found
      throw new Error(`Failed to fetch account: ${error.message}`);
    }

    return this.mapToDomain(data);
  }

  private mapToDomain(row: AccountRow): Account {
    return new Account({
      id: row.id,
      name: row.name,
      ownerId: row.owner_id,
      description: row.description,
      initialBalance: BigInt(row.initial_balance),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }
}
