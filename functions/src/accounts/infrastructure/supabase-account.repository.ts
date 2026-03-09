import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { AccountRepository } from '../domain/account.repository.interface';
import { Account } from '../domain/account.entity';

@Injectable()
export class SupabaseAccountRepository extends AccountRepository {
  constructor(
    @Inject('SUPABASE_CLIENT')
    private readonly supabase: SupabaseClient,
  ) {
    super();
  }

  async save(account: Account): Promise<void> {
    const { error } = await this.supabase
      .from('accounts')
      .upsert({
        id: account.id,
        name: account.name,
        owner_id: account.ownerId,
        initial_balance: account.initialBalance.toString(), // Convert to string for BIGINT
        updated_at: account.updatedAt.toISOString(),
      });

    if (error) {
      throw new Error(`Failed to save account: ${error.message}`);
    }
  }

  async findAllForUser(userId: string): Promise<Account[]> {
    // We select accounts where user is owner OR has a share
    // In Supabase/PostgREST, we can use an 'or' filter, but for joins it's easier to use a custom query or a view
    // Since we have a has_account_access RLS helper, let's just select all accounts and let RLS filter?
    // No, better to be explicit in the query for performance.
    
    // We'll use a trick: select accounts and join on account_shares
    const { data, error } = await this.supabase
      .from('accounts')
      .select('*, account_shares!left(user_id)')
      .or(`owner_id.eq.${userId},account_shares.user_id.eq.${userId}`);

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
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // No rows found
      throw new Error(`Failed to fetch account: ${error.message}`);
    }

    return this.mapToDomain(data);
  }

  private mapToDomain(row: any): Account {
    return new Account({
      id: row.id,
      name: row.name,
      ownerId: row.owner_id,
      initialBalance: BigInt(row.initial_balance),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }
}
