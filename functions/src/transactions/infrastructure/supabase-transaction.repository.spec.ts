import { SupabaseClient } from '@supabase/supabase-js';
import { ForbiddenError, NotFoundError } from '../../shared/domain/errors';
import { Transaction } from '../domain/transaction.entity';
import { SupabaseTransactionRepository } from './supabase-transaction.repository';
import {
  isInPeriodWindow,
  WindowPeriod,
} from '../../reporting/domain/period-window';
import { buildSearchFilter } from './search-filter';

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

describe('SupabaseTransactionRepository sumAmountByAccountBeforeDate', () => {
  it('throws when the rpc fails instead of returning a wrong 0 balance', async () => {
    const { repository } = repoWith({ message: 'rpc down' });

    await expect(
      repository.sumAmountByAccountBeforeDate('acc-1', new Date('2026-03-01')),
    ).rejects.toThrow('rpc down');
  });

  it('returns the sum as a bigint', async () => {
    const rpc = jest.fn().mockResolvedValue({ data: '12345', error: null });
    const repository = new SupabaseTransactionRepository({
      rpc,
    } as unknown as SupabaseClient);

    await expect(
      repository.sumAmountByAccountBeforeDate('acc-1', new Date('2026-03-01')),
    ).resolves.toBe(BigInt(12345));
    expect(rpc).toHaveBeenCalledWith('sum_transactions_before_date', {
      p_account_id: 'acc-1',
      p_date: '2026-03-01',
    });
  });
});

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

describe('SupabaseTransactionRepository ids filter', () => {
  // Chaîne de requête enregistrant les filtres appliqués, puis résolue.
  const listChain = () => {
    const calls: Array<[string, ...unknown[]]> = [];
    const result = { data: [], count: 0, error: null };
    const chain: Record<string, unknown> = {};
    for (const name of ['select', 'eq', 'in', 'order', 'range']) {
      chain[name] = (...args: unknown[]) => {
        calls.push([name, ...args]);
        return chain;
      };
    }
    chain.returns = () => Promise.resolve(result);
    const repository = new SupabaseTransactionRepository({
      from: () => chain,
    } as unknown as SupabaseClient);
    return { repository, calls };
  };

  const ids = ['id-1', 'id-2'];

  it('restricts the paginated list to the ids, always within the account', async () => {
    const { repository, calls } = listChain();

    await repository.findAllByAccount('acc-1', { ids });

    expect(calls).toContainEqual(['eq', 'account_id', 'acc-1']);
    expect(calls).toContainEqual(['in', 'id', ids]);
  });

  it('restricts the unpaginated list to the ids, always within the account', async () => {
    const { repository, calls } = listChain();

    await repository.findAllByAccountUnpaginated('acc-1', { ids });

    expect(calls).toContainEqual(['eq', 'account_id', 'acc-1']);
    expect(calls).toContainEqual(['in', 'id', ids]);
  });

  it('adds no id filter without ids', async () => {
    const { repository, calls } = listChain();

    await repository.findAllByAccount('acc-1', {});

    expect(calls.some(([n, col]) => n === 'in' && col === 'id')).toBe(false);
  });
});

describe('SupabaseTransactionRepository pending filter', () => {
  const listChain = () => {
    const calls: Array<[string, ...unknown[]]> = [];
    const result = { data: [], count: 0, error: null };
    const chain: Record<string, unknown> = {};
    for (const name of ['select', 'eq', 'in', 'order', 'range']) {
      chain[name] = (...args: unknown[]) => {
        calls.push([name, ...args]);
        return chain;
      };
    }
    chain.returns = () => Promise.resolve(result);
    const repository = new SupabaseTransactionRepository({
      from: () => chain,
    } as unknown as SupabaseClient);
    return { repository, calls };
  };

  // Même table de 4 lignes que operation-state.test.ts (front) : le front choisit
  // les paramètres, le back applique deux `eq` indépendants.
  const cases: Array<
    [
      string,
      { reconciled?: boolean; pending?: boolean },
      Array<[string, unknown]>,
    ]
  > = [
    [
      'a_pointer: reconciled=false&pending=false',
      { reconciled: false, pending: false },
      [
        ['reconciled', false],
        ['pending', false],
      ],
    ],
    [
      'a_venir: reconciled=false&pending=true',
      { reconciled: false, pending: true },
      [
        ['reconciled', false],
        ['pending', true],
      ],
    ],
    [
      'pointee: reconciled=true (pending not sent)',
      { reconciled: true },
      [['reconciled', true]],
    ],
    [
      'pending=true alone (pending reconciled included)',
      { pending: true },
      [['pending', true]],
    ],
    ['all: no filter', {}, []],
  ];

  it.each(cases)(
    '%s, paginated and unpaginated alike',
    async (_name, options, expected) => {
      const paginated = listChain();
      await paginated.repository.findAllByAccount('acc-1', options);
      const unpaginated = listChain();
      await unpaginated.repository.findAllByAccountUnpaginated(
        'acc-1',
        options,
      );

      for (const { calls } of [paginated, unpaginated]) {
        const flags = calls.filter(
          ([n, col]) =>
            n === 'eq' && (col === 'reconciled' || col === 'pending'),
        );
        expect(flags.map(([, col, val]) => [col, val])).toEqual(expected);
      }
    },
  );
});

describe('SupabaseTransactionRepository unpaginated list beyond the 1000-row server cap', () => {
  // Le serveur plafonne chaque réponse à 1000 lignes, quelle que soit la plage demandée.
  const SERVER_CAP = 1000;
  const chainOver = (total: number) => {
    const rows = Array.from({ length: total }, (_, i) => ({
      ...rowOf(tx(), null),
      id: `tx-${i}`,
    }));
    let from = 0;
    let to = Number.MAX_SAFE_INTEGER;
    const chain: Record<string, unknown> = {};
    for (const name of ['select', 'eq', 'order']) chain[name] = () => chain;
    chain.range = (f: number, t: number) => {
      from = f;
      to = t;
      return chain;
    };
    chain.returns = () =>
      Promise.resolve({
        data: rows.slice(from, Math.min(to + 1, from + SERVER_CAP)),
        error: null,
      });
    return new SupabaseTransactionRepository({
      from: () => chain,
    } as unknown as SupabaseClient);
  };

  it('returns every transaction of the account, not only the first 1000', async () => {
    const result = await chainOver(2500).findAllByAccountUnpaginated('acc-1');

    expect(result).toHaveLength(2500);
    expect(new Set(result.map((t) => t.id)).size).toBe(2500);
  });
});

// Base de données simulée : applique réellement les filtres posés par le dépôt
// (eq, gte, lte, in, or) à un jeu de lignes, puis le tri et la page. Les `.or()`
// sont lus comme PostgREST : chaque appel est un paramètre `or=` ; ils se combinent en ET.
describe('SupabaseTransactionRepository period window (paginated list)', () => {
  type Row = {
    id: string;
    account_id: string;
    date: string;
    amount: string;
    description: string;
    notes: string | null;
    reconciled: boolean;
    pending: boolean;
  };

  const row = (
    id: string,
    date: string,
    amount: number,
    extra: Partial<Row> = {},
  ): Row => ({
    id,
    account_id: 'acc-1',
    date,
    amount: String(amount),
    description: 'Opération',
    notes: null,
    reconciled: false,
    pending: false,
    ...extra,
  });

  const atom = (r: Row, cond: string): boolean => {
    const [col, op, ...rest] = cond.split('.');
    const raw = rest.join('.');
    if (col === 'description' || col === 'notes') {
      const v = raw.replace(/^"|"$/g, '').replace(/\\(.)/g, '$1');
      const target = (col === 'description' ? r.description : r.notes) ?? '';
      return op === 'imatch' && new RegExp(v, 'i').test(target);
    }
    const a = col === 'amount' ? Number(r.amount) : r.date;
    const b = col === 'amount' ? Number(raw) : raw;
    if (op === 'lt') return a < b;
    if (op === 'lte') return a <= b;
    if (op === 'gte') return a >= b;
    throw new Error(`op ${op}`);
  };

  const fakeDb = (rows: Row[]) => {
    const preds: Array<(r: Row) => boolean> = [];
    let ordering: Array<[keyof Row, boolean]> = [];
    let from = 0;
    let to = Infinity;
    const chain: Record<string, unknown> = {};
    const add = (name: string, make: (...a: any[]) => (r: Row) => boolean) => {
      chain[name] = (...args: unknown[]) => {
        preds.push(make(...args));
        return chain;
      };
    };
    chain.select = () => chain;
    add('eq', (c: keyof Row, v) => (r) => r[c] === v);
    add(
      'gte',
      (c: keyof Row, v) => (r) =>
        c === 'amount' ? Number(r.amount) >= Number(v) : r[c]! >= v,
    );
    add(
      'lte',
      (c: keyof Row, v) => (r) =>
        c === 'amount' ? Number(r.amount) <= Number(v) : r[c]! <= v,
    );
    add('in', (c: keyof Row, vs: unknown[]) => (r) => vs.includes(r[c]));
    add(
      'or',
      (f: string) => (r) => splitTopLevel(f).some((cond) => atom(r, cond)),
    );
    chain.order = (c: keyof Row, o: { ascending: boolean }) => {
      ordering.push([c, o.ascending]);
      return chain;
    };
    chain.range = (f: number, t: number) => {
      from = f;
      to = t;
      return chain;
    };
    chain.returns = () => {
      const kept = rows.filter((r) => preds.every((p) => p(r)));
      const sorted = [...kept].sort((x, y) => {
        for (const [c, asc] of ordering) {
          if (x[c]! === y[c]!) continue;
          return (x[c]! < y[c]! ? -1 : 1) * (asc ? 1 : -1);
        }
        return 0;
      });
      return Promise.resolve({
        data: sorted.slice(from, to + 1),
        count: kept.length,
        error: null,
      });
    };
    ordering = [];
    return new SupabaseTransactionRepository({
      from: () => chain,
    } as unknown as SupabaseClient);
  };

  // Découpe "a,b" en conditions, en respectant les guillemets (la recherche en contient).
  function splitTopLevel(f: string): string[] {
    const out: string[] = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < f.length; i++) {
      const ch = f[i];
      if (ch === '\\' && inQ) {
        cur += ch + f[++i];
        continue;
      }
      if (ch === '"') inQ = !inQ;
      if (ch === ',' && !inQ) {
        out.push(cur);
        cur = '';
      } else cur += ch;
    }
    out.push(cur);
    return out;
  }

  const active: WindowPeriod = {
    startDate: new Date('2026-11-01'),
    endDate: new Date('2026-11-30'),
    isActive: true,
  };
  const closed: WindowPeriod = { ...active, isActive: false };
  const open: WindowPeriod = { ...active, endDate: null };

  const dataset = [
    row('01', '2026-12-05', -12000, { pending: true }),
    row('02', '2026-12-05', -12000),
    row('03', '2026-12-05', -12000, { reconciled: true }),
    row('04', '2026-11-30', -12000),
    row('05', '2026-11-15', -12000),
    row('06', '2026-10-31', -12000),
    row('07', '2026-12-05', 12000),
    row('08', '2026-12-05', 12000, { description: 'Remboursement' }),
    row('09', '2026-12-05', 0),
    row('10', '2026-11-01', 5000),
  ];
  const asWindowTx = (r: Row) => ({
    date: new Date(r.date),
    amount: BigInt(r.amount),
  });

  it.each([
    ['active', active],
    ['closed', closed],
    ['without end', open],
  ])(
    'lists exactly what isInPeriodWindow keeps (%s period)',
    async (_name, period) => {
      const repository = fakeDb(dataset);
      const expected = dataset
        .filter((r) => isInPeriodWindow(asWindowTx(r), period))
        .map((r) => r.id)
        .sort();

      const result = await repository.findAllByAccount('acc-1', {
        periodWindow: period,
        limit: 100,
      });

      expect(result.data.map((t) => t.id).sort()).toEqual(expected);
      expect(result.meta.total).toBe(expected.length);
    },
  );

  it('counts the same cards as the forecast for the "À pointer" list', async () => {
    const repository = fakeDb(dataset);
    const expected = dataset.filter(
      (r) =>
        isInPeriodWindow(asWindowTx(r), active) && !r.reconciled && !r.pending,
    ).length;

    const result = await repository.findAllByAccount('acc-1', {
      periodWindow: active,
      reconciled: false,
      pending: false,
    });

    expect(result.meta.total).toBe(expected);
    expect(expected).toBeGreaterThan(0);
  });

  it('keeps the window when searching, in both directions, special characters included', async () => {
    const rows = [
      row('a', '2026-12-05', -12000, { description: 'Loyer (déc.)' }),
      row('b', '2026-12-05', -12000, { description: 'Cinéma' }),
      row('c', '2026-12-05', 12000, { description: 'Loyer (déc.)' }),
      row('d', '2026-10-01', -12000, { description: 'Loyer (déc.)' }),
      row('e', '2026-11-10', -500, { description: 'Loyer (déc.)' }),
    ];
    const repository = fakeDb(rows);
    expect(buildSearchFilter('Loyer (déc.)')).toContain('imatch');

    const result = await repository.findAllByAccount('acc-1', {
      periodWindow: active,
      search: 'Loyer (déc.)',
    });

    expect(result.data.map((t) => t.id).sort()).toEqual(['a', 'e']);
  });

  it('narrows the window with startDate and endDate, never widens it', async () => {
    const rows = [
      row('a', '2026-12-05', -12000), // réservée, après la fin de la période
      row('b', '2026-11-20', -12000),
      row('c', '2026-11-05', -12000),
      row('d', '2026-10-31', -12000), // hors fenêtre de la période
      row('e', '2026-11-30', -12000),
    ];
    const ids = async (o: object) =>
      (
        await fakeDb(rows).findAllByAccount('acc-1', {
          periodWindow: active,
          ...o,
        })
      ).data
        .map((t) => t.id)
        .sort();

    // sans date saisie : toute la fenêtre
    expect(await ids({})).toEqual(['a', 'b', 'c', 'e']);
    // cas 13 : endDate 30/11 retire la dépense réservée du 05/12
    expect(await ids({ endDate: new Date('2026-11-30') })).toEqual([
      'b',
      'c',
      'e',
    ]);
    // cas 14 : startDate 10/11 retire le 05/11 ; le 31/10 reste exclu
    expect(await ids({ startDate: new Date('2026-11-10') })).toEqual([
      'a',
      'b',
      'e',
    ]);
    // startDate avant le début de la période : n'élargit pas (31/10 exclu)
    expect(await ids({ startDate: new Date('2026-10-01') })).toEqual([
      'a',
      'b',
      'c',
      'e',
    ]);
    // endDate après la fin : n'ajoute rien, la réservée reste
    expect(await ids({ endDate: new Date('2027-01-31') })).toEqual([
      'a',
      'b',
      'c',
      'e',
    ]);
    // début après la fin : liste vide, pas d'erreur
    const empty = await fakeDb(rows).findAllByAccount('acc-1', {
      periodWindow: active,
      startDate: new Date('2026-11-20'),
      endDate: new Date('2026-11-10'),
    });
    expect(empty.data).toEqual([]);
    expect(empty.meta.total).toBe(0);
  });

  it('ignores an id of another account and keeps the window', async () => {
    const rows = [
      row('a', '2026-12-05', -12000),
      row('x', '2026-12-05', -12000, { account_id: 'acc-2' }),
      row('c', '2026-12-05', 12000),
    ];
    const result = await fakeDb(rows).findAllByAccount('acc-1', {
      periodWindow: active,
      ids: ['a', 'x', 'c'],
    });

    expect(result.data.map((t) => t.id)).toEqual(['a']);
  });

  it('pages without repeats or gaps when many rows share the same date', async () => {
    // Insérées dans le désordre : seul .order('id') donne un ordre stable.
    const rows = [3, 0, 6, 2, 5, 1, 4].map((i) =>
      row(`id-${i}`, '2026-12-05', -100),
    );
    const repository = fakeDb(rows);
    const seen: string[] = [];
    for (const page of [1, 2, 3, 4]) {
      const r = await repository.findAllByAccount('acc-1', {
        periodWindow: active,
        page,
        limit: 2,
      });
      expect(r.meta.totalPages).toBe(4);
      seen.push(...r.data.map((t) => t.id));
    }

    expect(seen).toEqual(rows.map((r) => r.id).sort());
  });
});
