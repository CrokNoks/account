import { SupabaseClient } from '@supabase/supabase-js';
import { Transaction } from '../domain/transaction.entity';
import { SupabaseTransactionRepository } from './supabase-transaction.repository';

const tx = (
  overrides: Partial<Parameters<typeof Transaction.create>[0]> = {},
) =>
  Transaction.create({
    accountId: 'acc-1',
    categoryId: null,
    date: new Date('2026-03-01'),
    description: 'Virement',
    amount: BigInt(-15000),
    reconciled: false,
    pending: false,
    ...overrides,
  });

const repoWith = (error: { code?: string; message: string } | null) => {
  const rpc = jest
    .fn<Promise<unknown>, [string, Record<string, Record<string, unknown>>]>()
    .mockResolvedValue({ data: null, error });
  const from = jest.fn();
  const repository = new SupabaseTransactionRepository({
    rpc,
    from,
  } as unknown as SupabaseClient);
  return { repository, rpc, from };
};

describe('SupabaseTransactionRepository atomic writes', () => {
  describe('saveTransfer', () => {
    it('calls create_transfer once with both sides and writes nothing else', async () => {
      const { repository, rpc, from } = repoWith(null);
      const debit = tx({ amount: BigInt(-15000) });
      const credit = tx({ accountId: 'acc-2', amount: BigInt(15000) });

      await repository.saveTransfer(debit, credit);

      expect(rpc).toHaveBeenCalledTimes(1);
      expect(rpc.mock.calls[0][0]).toBe('create_transfer');
      expect(rpc.mock.calls[0][1]).toEqual({
        p_debit: expect.objectContaining({ id: debit.id }) as unknown,
        p_credit: expect.objectContaining({ id: credit.id }) as unknown,
      });
      const params = rpc.mock.calls[0][1];
      expect(params.p_debit).toMatchObject({
        account_id: 'acc-1',
        amount: '-15000',
        date: '2026-03-01',
        tag_ids: [],
      });
      expect(params.p_credit).toMatchObject({
        account_id: 'acc-2',
        amount: '15000',
      });
      expect(from).not.toHaveBeenCalled();
    });

    it('throws the database error', async () => {
      const { repository } = repoWith({ message: 'row-level security' });

      await expect(repository.saveTransfer(tx(), tx())).rejects.toThrow(
        'row-level security',
      );
    });
  });
});
