import { SupabaseClient } from '@supabase/supabase-js';
import { AccountShare } from '../domain/account-share.entity';
import { SupabaseAccountShareRepository } from './supabase-account-share.repository';

const share = new AccountShare({
  accountId: 'acc-1',
  userId: 'user-2',
  permission: 'write',
});

const repoWith = (error: { code?: string; message: string } | null) => {
  const upsert = jest.fn().mockResolvedValue({ error });
  const supabase = { from: jest.fn().mockReturnValue({ upsert }) };
  return {
    repository: new SupabaseAccountShareRepository(
      supabase as unknown as SupabaseClient,
    ),
    supabase,
    upsert,
  };
};

describe('SupabaseAccountShareRepository.save', () => {
  it('upserts on (account_id, user_id) so that sharing again updates the permission', async () => {
    const { repository, supabase, upsert } = repoWith(null);
    await expect(repository.save(share)).resolves.toBeUndefined();
    expect(supabase.from).toHaveBeenCalledWith('account_shares');
    expect(upsert).toHaveBeenCalledWith(
      { account_id: 'acc-1', user_id: 'user-2', permission: 'write' },
      { onConflict: 'account_id,user_id' },
    );
  });

  it('keeps a database error as is', async () => {
    const { repository } = repoWith({ message: 'boom' });
    await expect(repository.save(share)).rejects.toThrow('boom');
  });
});
