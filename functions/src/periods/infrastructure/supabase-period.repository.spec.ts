import { SupabaseClient } from '@supabase/supabase-js';
import { ConflictError } from '../../shared/domain/errors';
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

  it('keeps any other database error as is', async () => {
    const { repository } = repoWith({ code: '42501', message: 'rls' });

    const result = repository.createWithBudgets(period, [], []);
    await expect(result).rejects.not.toBeInstanceOf(ConflictError);
    await expect(result).rejects.toThrow('rls');
  });
});
