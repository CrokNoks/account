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

  describe('saveMany', () => {
    it('calls create_transactions once with every line and its tags', async () => {
      const { repository, rpc, from } = repoWith(null);
      const a = tx({ description: 'A', tagIds: ['tag-1', 'tag-2'] });
      const b = tx({ description: 'B', amount: BigInt(-200) });

      await repository.saveMany([a, b]);

      expect(rpc).toHaveBeenCalledTimes(1);
      expect(rpc.mock.calls[0][0]).toBe('create_transactions');
      const lines = rpc.mock.calls[0][1].p_transactions as unknown as Array<
        Record<string, unknown>
      >;
      expect(lines).toHaveLength(2);
      expect(lines[0]).toMatchObject({
        id: a.id,
        description: 'A',
        tag_ids: ['tag-1', 'tag-2'],
      });
      expect(lines[1]).toMatchObject({
        id: b.id,
        amount: '-200',
        tag_ids: [],
      });
      expect(from).not.toHaveBeenCalled();
    });

    it('throws the database error', async () => {
      const { repository } = repoWith({ message: 'row-level security' });

      await expect(repository.saveMany([tx()])).rejects.toThrow(
        'row-level security',
      );
    });
  });

  describe('save', () => {
    it('calls save_transaction once with the transaction and its tags', async () => {
      const { repository, rpc, from } = repoWith(null);
      const t = tx({ tagIds: ['tag-1'] });

      await repository.save(t);

      expect(rpc).toHaveBeenCalledTimes(1);
      expect(rpc.mock.calls[0][0]).toBe('save_transaction');
      expect(rpc.mock.calls[0][1].p_transaction).toMatchObject({
        id: t.id,
        account_id: 'acc-1',
        amount: '-15000',
        tag_ids: ['tag-1'],
      });
      expect(from).not.toHaveBeenCalled();
    });

    it('throws the database error', async () => {
      const { repository } = repoWith({ message: 'row-level security' });

      await expect(repository.save(tx())).rejects.toThrow('row-level security');
    });
  });
});
