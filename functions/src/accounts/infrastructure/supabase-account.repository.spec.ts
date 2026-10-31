import { SupabaseClient } from '@supabase/supabase-js';
import { Account } from '../domain/account.entity';
import { SupabaseAccountRepository } from './supabase-account.repository';

describe('SupabaseAccountRepository.save', () => {
  it('writes exactly the account columns (no description)', async () => {
    const upsert = jest.fn().mockResolvedValue({ error: null });
    const supabase = { from: jest.fn().mockReturnValue({ upsert }) };
    const repository = new SupabaseAccountRepository(
      supabase as unknown as SupabaseClient,
    );

    await repository.save(
      new Account({
        id: 'acc-1',
        name: 'Courant',
        ownerId: 'user-1',
        initialBalance: BigInt(1000),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
    );

    expect(supabase.from).toHaveBeenCalledWith('accounts');
    expect(upsert).toHaveBeenCalledWith({
      id: 'acc-1',
      name: 'Courant',
      owner_id: 'user-1',
      initial_balance: '1000',
      updated_at: '2026-01-01T00:00:00.000Z',
    });
  });
});
