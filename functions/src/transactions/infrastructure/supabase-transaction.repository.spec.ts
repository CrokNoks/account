import { SupabaseClient } from '@supabase/supabase-js';
import { ForbiddenError, NotFoundError } from '../../shared/domain/errors';
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

const deleteChain = (error: { code?: string; message: string } | null) => {
  const inFn = jest.fn().mockResolvedValue({ error });
  const del = jest.fn().mockReturnValue({ in: inFn });
  const from = jest.fn().mockReturnValue({ delete: del });
  const repository = new SupabaseTransactionRepository({
    from,
  } as unknown as SupabaseClient);
  return { repository, from, inFn };
};

const rowOf = (t: Transaction, periodId: string | null) => ({
  id: t.id,
  account_id: t.accountId,
  category_id: null,
  period_id: periodId,
  date: '2026-03-01',
  description: t.description,
  amount: t.amount.toString(),
  reconciled: false,
  pending: false,
  notes: null,
  metadata: {},
  created_at: '2026-03-01T00:00:00Z',
  updated_at: '2026-03-01T00:00:00Z',
  transaction_tags: [],
});

// Relecture après écriture : select(...).in('id', ids) renvoie les lignes données.
const readBack = (result: { data: unknown; error: unknown }) => {
  const returns = jest.fn().mockResolvedValue(result);
  const inFn = jest.fn().mockReturnValue({ returns });
  const select = jest.fn().mockReturnValue({ in: inFn });
  const from = jest.fn().mockReturnValue({ select });
  return { from, select, inFn };
};

const repoWith = (error: { code?: string; message: string } | null) => {
  const rpc = jest
    .fn<Promise<unknown>, [string, Record<string, Record<string, unknown>>]>()
    .mockResolvedValue({ data: null, error });
  const from = jest.fn().mockReturnValue({
    select: () => ({
      in: () => ({ returns: () => Promise.resolve({ data: [], error: null }) }),
    }),
  });
  const repository = new SupabaseTransactionRepository({
    rpc,
    from,
  } as unknown as SupabaseClient);
  return { repository, rpc };
};

describe('SupabaseTransactionRepository atomic writes', () => {
  describe('saveTransfer', () => {
    it('calls create_transfer once with both sides and writes nothing else', async () => {
      const { repository, rpc } = repoWith(null);
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
      const { repository, rpc } = repoWith(null);
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
    });

    it('throws the database error', async () => {
      const { repository } = repoWith({ message: 'row-level security' });

      await expect(repository.saveMany([tx()])).rejects.toThrow(
        'row-level security',
      );
    });
  });

  describe('save', () => {
    it('turns an RLS refusal (42501) of the rpc into a ForbiddenError', async () => {
      const { repository } = repoWith({
        code: '42501',
        message: 'new row violates row-level security policy for table "x"',
      });

      const result = repository.save(tx());
      await expect(result).rejects.toBeInstanceOf(ForbiddenError);
      await expect(result).rejects.not.toThrow(/row-level security/);
    });

    it('calls save_transaction once with the transaction and its tags', async () => {
      const { repository, rpc } = repoWith(null);
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
    });

    it('throws the database error', async () => {
      const { repository } = repoWith({ message: 'row-level security' });

      await expect(repository.save(tx())).rejects.toThrow('row-level security');
    });
  });

  describe('updateMany', () => {
    it('calls update_transactions once with every transaction and its tags', async () => {
      const { repository, rpc } = repoWith(null);
      const a = tx({ tagIds: ['tag-1'] });
      const b = tx({ description: 'B' });

      await repository.updateMany([a, b]);

      expect(rpc).toHaveBeenCalledTimes(1);
      expect(rpc.mock.calls[0][0]).toBe('update_transactions');
      const lines = rpc.mock.calls[0][1].p_transactions as unknown as Array<
        Record<string, unknown>
      >;
      expect(lines.map((l) => l.id)).toEqual([a.id, b.id]);
      expect(lines[0].tag_ids).toEqual(['tag-1']);
    });

    it('turns P0002 (transaction not found) into a NotFoundError', async () => {
      const { repository } = repoWith({
        code: 'P0002',
        message: 'transaction not found',
      });

      await expect(repository.updateMany([tx()])).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });

    it('throws any other database error as is', async () => {
      const { repository } = repoWith({ code: 'XX000', message: 'rls' });

      const result = repository.updateMany([tx()]);
      await expect(result).rejects.not.toBeInstanceOf(NotFoundError);
      await expect(result).rejects.toThrow('rls');
    });
  });

  describe('deleteMany', () => {
    it('deletes every id with a single DELETE ... IN request', async () => {
      const { repository, from, inFn } = deleteChain(null);

      await repository.deleteMany(['t1', 't2']);

      expect(from).toHaveBeenCalledTimes(1);
      expect(from).toHaveBeenCalledWith('transactions');
      expect(inFn).toHaveBeenCalledTimes(1);
      expect(inFn).toHaveBeenCalledWith('id', ['t1', 't2']);
    });

    it('sends nothing for an empty list', async () => {
      const { repository, from } = deleteChain(null);

      await repository.deleteMany([]);

      expect(from).not.toHaveBeenCalled();
    });

    it('turns an RLS refusal (42501) into a ForbiddenError', async () => {
      const { repository } = deleteChain({ code: '42501', message: 'rls' });

      await expect(repository.deleteMany(['t1'])).rejects.toBeInstanceOf(
        ForbiddenError,
      );
    });

    it('throws the database error', async () => {
      const { repository } = deleteChain({ message: 'boom' });

      await expect(repository.deleteMany(['t1'])).rejects.toThrow('boom');
    });
  });
});

describe('SupabaseTransactionRepository returns the rows as stored', () => {
  const build = (read: { data: unknown; error: unknown }) => {
    const rpc = jest.fn().mockResolvedValue({ data: null, error: null });
    const back = readBack(read);
    const repository = new SupabaseTransactionRepository({
      rpc,
      from: back.from,
    } as unknown as SupabaseClient);
    return { repository, back };
  };

  it('save returns the period assigned by the database trigger', async () => {
    const t = tx();
    const { repository, back } = build({
      data: [rowOf(t, 'period-1')],
      error: null,
    });

    const saved = await repository.save(t);

    expect(back.from).toHaveBeenCalledWith('transactions');
    expect(back.inFn).toHaveBeenCalledWith('id', [t.id]);
    expect(saved.periodId).toBe('period-1');
    expect(saved.id).toBe(t.id);
  });

  it('saveTransfer returns both sides with their period, in order', async () => {
    const debit = tx();
    const credit = tx({ accountId: 'acc-2', amount: BigInt(15000) });
    const { repository } = build({
      data: [rowOf(credit, 'p-credit'), rowOf(debit, 'p-debit')],
      error: null,
    });

    const [d, c] = await repository.saveTransfer(debit, credit);

    expect(d.id).toBe(debit.id);
    expect(d.periodId).toBe('p-debit');
    expect(c.id).toBe(credit.id);
    expect(c.periodId).toBe('p-credit');
  });

  it('saveMany returns every line with its period, in order', async () => {
    const a = tx({ description: 'A' });
    const b = tx({ description: 'B' });
    const { repository } = build({
      data: [rowOf(b, 'p2'), rowOf(a, 'p1')],
      error: null,
    });

    const saved = await repository.saveMany([a, b]);

    expect(saved.map((t) => [t.id, t.periodId])).toEqual([
      [a.id, 'p1'],
      [b.id, 'p2'],
    ]);
  });

  it('falls back to the written entity when the read-back fails (the write is committed)', async () => {
    const t = tx();
    const { repository } = build({ data: null, error: { message: 'down' } });
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    await expect(repository.save(t)).resolves.toBe(t);
  });
});
