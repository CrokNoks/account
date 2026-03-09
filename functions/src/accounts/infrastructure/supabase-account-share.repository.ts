import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { AccountShareRepository } from '../domain/account-share.repository.interface';
import { AccountShare } from '../domain/account-share.entity';

@Injectable()
export class SupabaseAccountShareRepository extends AccountShareRepository {
  constructor(
    @Inject('SUPABASE_CLIENT')
    private readonly supabase: SupabaseClient,
  ) {
    super();
  }

  async findAllByAccount(accountId: string): Promise<AccountShare[]> {
    const { data, error } = await this.supabase
      .from('account_shares')
      .select('*, app_users(email)')
      .eq('account_id', accountId);

    if (error) {
      throw new Error(`Failed to fetch shares: ${error.message}`);
    }

    return (data || []).map((row) => new AccountShare({
      id: row.id,
      accountId: row.account_id,
      userId: row.user_id,
      userEmail: row.app_users?.email,
      permission: row.permission as 'read' | 'write',
      createdAt: new Date(row.created_at),
    }));
  }

  async save(share: AccountShare): Promise<void> {
    const { error } = await this.supabase
      .from('account_shares')
      .upsert({
        account_id: share.accountId,
        user_id: share.userId,
        permission: share.permission,
      });

    if (error) {
      throw new Error(`Failed to save share: ${error.message}`);
    }
  }

  async delete(accountId: string, userId: string): Promise<void> {
    const { error } = await this.supabase
      .from('account_shares')
      .delete()
      .eq('account_id', accountId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to delete share: ${error.message}`);
    }
  }
}
