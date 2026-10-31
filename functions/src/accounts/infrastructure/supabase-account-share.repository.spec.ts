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

describe('SupabaseAccountShareRepository.findAllByAccount', () => {
  const query = (result: unknown) => {
    const q: Record<string, jest.Mock> = {};
    q.select = jest.fn().mockReturnValue(q);
    q.eq = jest.fn().mockReturnValue(q);
    q.in = jest.fn().mockReturnValue(q);
    q.returns = jest.fn().mockResolvedValue(result);
    return q;
  };

  it('reads the shares then the emails from app_users, without embedding a relation', async () => {
    const shares = query({
      data: [
        {
          id: 's1',
          account_id: 'acc-1',
          user_id: 'user-2',
          permission: 'write',
          created_at: '2026-01-01T00:00:00Z',
        },
      ],
      error: null,
    });
    const users = query({
      data: [{ id: 'user-2', email: 'bob@test.local' }],
      error: null,
    });
    const from = jest.fn((table: string) =>
      table === 'account_shares' ? shares : users,
    );
    const repository = new SupabaseAccountShareRepository({
      from,
    } as unknown as SupabaseClient);

    const result = await repository.findAllByAccount('acc-1');

    expect(shares.select).toHaveBeenCalledWith('*');
    expect(users.in).toHaveBeenCalledWith('id', ['user-2']);
    expect(result).toHaveLength(1);
    expect(result[0].userEmail).toBe('bob@test.local');
    expect(result[0].permission).toBe('write');
  });

  it('does not query app_users when there is no share', async () => {
    const shares = query({ data: [], error: null });
    const from = jest.fn().mockReturnValue(shares);
    const repository = new SupabaseAccountShareRepository({
      from,
    } as unknown as SupabaseClient);
    await expect(repository.findAllByAccount('acc-1')).resolves.toEqual([]);
    expect(from).toHaveBeenCalledTimes(1);
  });
});
