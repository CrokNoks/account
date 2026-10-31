import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { AccountShareRepository } from '../domain/account-share.repository.interface';
import { AccountShare } from '../domain/account-share.entity';
import { toDomainError } from '../../shared/infrastructure/supabase-error';

interface AccountShareRow {
  id: string;
  account_id: string;
  user_id: string;
  permission: string;
  created_at: string;
}

interface AppUserRow {
  id: string;
  email: string;
}

@Injectable()
export class SupabaseAccountShareRepository extends AccountShareRepository {
  constructor(
    @Inject('SUPABASE_CLIENT')
    private readonly supabase: SupabaseClient,
  ) {
    super();
  }

  async findAllByAccount(accountId: string): Promise<AccountShare[]> {
    // account_shares.user_id references auth.users, not app_users: there is no
    // relationship PostgREST could embed, so the emails are read separately.
    const { data, error } = await this.supabase
      .from('account_shares')
      .select('*')
      .eq('account_id', accountId)
      .returns<AccountShareRow[]>();

    if (error) {
      throw new Error(`Failed to fetch shares: ${error.message}`);
    }

    const rows = data || [];
    const emails = new Map<string, string>();
    if (rows.length > 0) {
      const { data: users, error: usersError } = await this.supabase
        .from('app_users')
        .select('id, email')
        .in(
          'id',
          rows.map((row) => row.user_id),
        )
        .returns<AppUserRow[]>();

      if (usersError) {
        throw new Error(`Failed to fetch share users: ${usersError.message}`);
      }
      for (const user of users || []) emails.set(user.id, user.email);
    }

    return rows.map(
      (row) =>
        new AccountShare({
          id: row.id,
          accountId: row.account_id,
          userId: row.user_id,
          userEmail: emails.get(row.user_id) || '',
          permission: row.permission as 'read' | 'write',
          createdAt: new Date(row.created_at),
        }),
    );
  }

  async save(share: AccountShare): Promise<void> {
    const { error } = await this.supabase.from('account_shares').upsert(
      {
        account_id: share.accountId,
        user_id: share.userId,
        permission: share.permission,
      },
      { onConflict: 'account_id,user_id' },
    );

    if (error) {
      throw toDomainError(error, { prefix: 'Failed to save share: ' });
    }
  }

  async delete(accountId: string, userId: string): Promise<void> {
    const { error } = await this.supabase
      .from('account_shares')
      .delete()
      .eq('account_id', accountId)
      .eq('user_id', userId);

    if (error) {
      throw toDomainError(error, { prefix: 'Failed to delete share: ' });
    }
  }
}
