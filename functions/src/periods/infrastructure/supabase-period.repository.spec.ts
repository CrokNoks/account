import { SupabaseClient } from '@supabase/supabase-js';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../shared/domain/errors';
import { BudgetInstance } from '../../budgets/domain/budget-instance.entity';
import { Transaction } from '../../transactions/domain/transaction.entity';
import { Period } from '../domain/period.entity';
import { SupabasePeriodRepository } from './supabase-period.repository';

const period = Period.create({
  accountId: 'acc-1',
  startDate: new Date('2026-03-01'),
  endDate: new Date('2026-03-31'),
});
const budget = BudgetInstance.create({
  periodId: period.id,
  categoryId: 'cat-1',
  amountAllocated: BigInt(-1000),
});
const transaction = Transaction.create({
  accountId: 'acc-1',
  categoryId: 'cat-1',
  date: new Date('2026-03-05'),
  description: 'Loyer',
  amount: BigInt(-50000),
  periodId: period.id,
  reconciled: false,
  pending: true,
  metadata: { source: 'recurring' },
});

const generatedTransaction = Transaction.create({
  accountId: 'acc-1',
  categoryId: 'cat-1',
  date: new Date('2026-12-05'),
  description: 'Loyer généré',
  amount: BigInt(-50000),
  reconciled: false,
  pending: true,
  metadata: { source: 'recurring' },
});

type Params = {
  p_period: Record<string, unknown>;
  p_budgets: Array<Record<string, unknown>>;
  p_transactions: Array<Record<string, unknown>>;
};

const repoWith = (error: { code?: string; message: string } | null) => {
  const rpc = jest
    .fn<Promise<unknown>, [string, Params]>()
    .mockResolvedValue({ data: null, error });
  const from = jest.fn();
  const repository = new SupabasePeriodRepository({
    rpc,
    from,
  } as unknown as SupabaseClient);
  return { repository, rpc, from };
};

describe('SupabasePeriodRepository.createWithBudgets', () => {
  it('calls create_period_with_budgets once with the period, budgets and transactions', async () => {
    const { repository, rpc, from } = repoWith(null);

    await repository.createWithBudgets(period, [budget], [transaction]);

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0][0]).toBe('create_period_with_budgets');
    const params = rpc.mock.calls[0][1];
    expect(params.p_period).toMatchObject({
      id: period.id,
      account_id: 'acc-1',
      start_date: '2026-03-01',
      end_date: '2026-03-31',
      is_active: true,
    });
    expect(params.p_budgets).toEqual([
      expect.objectContaining({
        id: budget.id,
        period_id: period.id,
        category_id: 'cat-1',
        amount_allocated: '-1000',
      }) as unknown,
    ]);
    expect(params.p_transactions).toEqual([
      expect.objectContaining({
        id: transaction.id,
        period_id: period.id,
        amount: '-50000',
        pending: true,
        tag_ids: [],
      }) as unknown,
    ]);
    expect(from).not.toHaveBeenCalled();
  });

  it('turns a duplicated budget category (23505) into a ConflictError', async () => {
    const { repository } = repoWith({
      code: '23505',
      message:
        'duplicate key value violates unique constraint "budget_instances_period_id_category_id_key"',
    });

    await expect(
      repository.createWithBudgets(period, [budget, budget], []),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('turns an overlapping period (23P01) into a 409 ConflictError on creation', async () => {
    const { repository } = repoWith({
      code: '23P01',
      message:
        'conflicting key value violates exclusion constraint "periods_no_overlap"',
    });

    const result = repository.createWithBudgets(period, [], []);
    await expect(result).rejects.toBeInstanceOf(ConflictError);
    await expect(result).rejects.toThrow('Period overlaps an existing period');
  });

  it('turns an overlapping period (23P01) into a ConflictError on date change', async () => {
    const upsert = jest.fn().mockResolvedValue({
      error: { code: '23P01', message: 'periods_no_overlap' },
    });
    const repository = new SupabasePeriodRepository({
      from: jest.fn().mockReturnValue({ upsert }),
    } as unknown as SupabaseClient);

    const result = repository.save(period);
    await expect(result).rejects.toBeInstanceOf(ConflictError);
    await expect(result).rejects.toThrow('Period overlaps an existing period');
  });

  it('turns a second active period (23505 on periods_one_active_per_account) into a 409 on reactivation', async () => {
    const upsert = jest.fn().mockResolvedValue({
      error: {
        code: '23505',
        message:
          'duplicate key value violates unique constraint "periods_one_active_per_account"',
      },
    });
    const repository = new SupabasePeriodRepository({
      from: jest.fn().mockReturnValue({ upsert }),
    } as unknown as SupabaseClient);

    const result = repository.save(period);
    await expect(result).rejects.toBeInstanceOf(ConflictError);
    await expect(result).rejects.toThrow(
      'Another period is already active for this account',
    );
  });

  it('turns a second active period (23505) into the same 409 on creation', async () => {
    const { repository } = repoWith({
      code: '23505',
      message:
        'duplicate key value violates unique constraint "periods_one_active_per_account"',
    });

    const result = repository.createWithBudgets(period, [], []);
    await expect(result).rejects.toBeInstanceOf(ConflictError);
    await expect(result).rejects.toThrow(
      'Another period is already active for this account',
    );
  });

  it('keeps the budget message for a duplicated budget category (23505)', async () => {
    const { repository } = repoWith({
      code: '23505',
      message:
        'duplicate key value violates unique constraint "budget_instances_period_id_category_id_key"',
    });

    await expect(
      repository.createWithBudgets(period, [budget, budget], []),
    ).rejects.toThrow(
      'A budget already exists for this category in this period',
    );
  });

  it('keeps any other database error as is', async () => {
    const { repository } = repoWith({ code: 'XX000', message: 'rls' });

    const result = repository.createWithBudgets(period, [], []);
    await expect(result).rejects.not.toBeInstanceOf(ConflictError);
    await expect(result).rejects.toThrow('rls');
  });
});

describe('SupabasePeriodRepository.findById', () => {
  it('exposes estimated_end_date of an open period as estimatedEndDate', async () => {
    const single = jest.fn().mockResolvedValue({
      data: {
        id: 'p-1',
        account_id: 'acc-1',
        start_date: '2026-11-01',
        end_date: null,
        estimated_end_date: '2026-11-30',
        is_active: true,
        created_at: '2026-11-01T00:00:00Z',
        updated_at: '2026-11-01T00:00:00Z',
      },
      error: null,
    });
    const query = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      returns: jest.fn().mockReturnThis(),
      single,
    };
    const repository = new SupabasePeriodRepository({
      from: jest.fn().mockReturnValue(query),
    } as unknown as SupabaseClient);

    const found = await repository.findById('p-1');

    expect(found?.endDate).toBeNull();
    expect(found?.estimatedEndDate).toEqual(new Date('2026-11-30'));
  });
});

describe('SupabasePeriodRepository.applyPeriodSwitches', () => {
  const opened = Period.create({
    id: 'p-new',
    accountId: 'acc-1',
    startDate: new Date('2026-11-28'),
    endDate: new Date('2026-12-27'),
  });
  const sw = {
    closedId: 'p-old',
    closeEnd: new Date('2026-11-27'),
    closedPrevEnd: new Date('2026-12-05') as Date | null,
    opened,
    budgets: [budget],
  };
  const repoReturning = (
    data: unknown,
    error: { code?: string; message: string } | null = null,
  ) => {
    const rpc = jest.fn().mockResolvedValue({ data, error });
    const repository = new SupabasePeriodRepository({
      rpc,
    } as unknown as SupabaseClient);
    return { repository, rpc };
  };

  it('calls apply_period_switches once with the account, the expected active period, the switches and the transactions', async () => {
    const { repository, rpc } = repoReturning({ switched: true, removed: 1 });

    const result = await repository.applyPeriodSwitches(
      'acc-1',
      'p-old',
      [sw],
      [transaction],
      [generatedTransaction],
      ['pending-1'],
      true,
    );

    expect(result).toEqual({ switched: true, removed: 1 });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('apply_period_switches', {
      p_account_id: 'acc-1',
      p_expected_active_id: 'p-old',
      p_switches: [
        {
          closed_id: 'p-old',
          close_end: '2026-11-27',
          closed_prev_end: '2026-12-05',
          opened: expect.objectContaining({
            id: 'p-new',
            account_id: 'acc-1',
            start_date: '2026-11-28',
            end_date: '2026-12-27',
          }) as unknown,
          budgets: [expect.objectContaining({ category_id: 'cat-1' })],
        },
      ],
      p_transactions: [expect.objectContaining({ id: transaction.id })],
      p_generated: [expect.objectContaining({ id: generatedTransaction.id })],
      p_remove_pending_ids: ['pending-1'],
      p_update: true,
    });
  });

  it('always sends closed_prev_end, null when the closed period had no end (key present, not absent)', async () => {
    const { repository, rpc } = repoReturning({ switched: true });

    await repository.applyPeriodSwitches(
      'acc-1',
      'p-old',
      [{ ...sw, closedPrevEnd: null }],
      [],
      [],
    );

    const payload = (rpc.mock.calls[0] as [string, { p_switches: object[] }])[1]
      .p_switches[0];
    expect(payload).toHaveProperty('closed_prev_end', null);
  });

  it('defaults to create mode (p_update false)', async () => {
    const { repository, rpc } = repoReturning({ switched: true });

    await repository.applyPeriodSwitches(
      'acc-1',
      'p-old',
      [sw],
      [transaction],
      [],
    );

    expect(rpc).toHaveBeenCalledWith(
      'apply_period_switches',
      expect.objectContaining({ p_update: false }),
    );
  });

  it('reports a lost concurrent switch as switched false', async () => {
    const { repository } = repoReturning({
      switched: false,
      reason: 'concurrent',
    });

    await expect(
      repository.applyPeriodSwitches('acc-1', 'p-old', [sw], [transaction], []),
    ).resolves.toEqual({ switched: false, removed: 0 });
  });

  it('maps an overlap (23P01) and a read-only member (42501) to domain errors', async () => {
    const overlap = repoReturning(null, { code: '23P01', message: 'x' });
    await expect(
      overlap.repository.applyPeriodSwitches('acc-1', 'p-old', [sw], [], []),
    ).rejects.toBeInstanceOf(ConflictError);

    const readOnly = repoReturning(null, { code: '42501', message: 'x' });
    await expect(
      readOnly.repository.applyPeriodSwitches('acc-1', 'p-old', [sw], [], []),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('maps a transaction that disappeared in update mode (P0002) to the same 404 as update_transactions', async () => {
    const gone = repoReturning(null, { code: 'P0002', message: 'x' });

    await expect(
      gone.repository.applyPeriodSwitches(
        'acc-1',
        'p-old',
        [sw],
        [],
        [],
        [],
        true,
      ),
    ).rejects.toMatchObject({
      constructor: NotFoundError,
      message: 'Transaction not found',
    });
  });
});
