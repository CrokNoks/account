import { SupabaseClient } from '@supabase/supabase-js';
import { ConflictError } from '../../shared/domain/errors';
import { BudgetInstance } from '../domain/budget-instance.entity';
import { SupabaseBudgetRepository } from './supabase-budget.repository';

const instance = BudgetInstance.create({
  periodId: 'per-1',
  categoryId: 'cat-1',
  amountAllocated: BigInt(100),
});
const duplicate = {
  code: '23505',
  message:
    'duplicate key value violates unique constraint "budget_instances_period_id_category_id_key"',
};

const repoWith = (error: { code?: string; message: string } | null) => {
  const op = jest.fn().mockResolvedValue({ error });
  const supabase = {
    from: jest.fn().mockReturnValue({ upsert: op, insert: op }),
  };
  return new SupabaseBudgetRepository(supabase as unknown as SupabaseClient);
};

describe('SupabaseBudgetRepository unique violation', () => {
  it('save turns 23505 into a ConflictError', async () => {
    await expect(repoWith(duplicate).save(instance)).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it('keeps any other database error as is', async () => {
    const result = repoWith({ code: '42P01', message: 'boom' }).save(instance);
    await expect(result).rejects.not.toBeInstanceOf(ConflictError);
    await expect(result).rejects.toThrow('boom');
  });
});

describe('SupabaseBudgetRepository.replaceForPeriod', () => {
  const rpcRepo = (error: { code?: string; message: string } | null) => {
    const rpc = jest
      .fn<Promise<unknown>, [string, Record<string, unknown>]>()
      .mockResolvedValue({ data: null, error });
    const from = jest.fn();
    const repository = new SupabaseBudgetRepository({
      rpc,
      from,
    } as unknown as SupabaseClient);
    return { repository, rpc, from };
  };

  it('calls replace_period_budgets once with the period and the new budgets', async () => {
    const { repository, rpc, from } = rpcRepo(null);

    await repository.replaceForPeriod('per-1', [instance]);

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0][0]).toBe('replace_period_budgets');
    expect(rpc.mock.calls[0][1]).toEqual({
      p_period_id: 'per-1',
      p_budgets: [
        expect.objectContaining({
          id: instance.id,
          period_id: 'per-1',
          category_id: 'cat-1',
          amount_allocated: '100',
        }) as unknown,
      ],
    });
    expect(from).not.toHaveBeenCalled();
  });

  it('sends an empty list to just remove the budgets', async () => {
    const { repository, rpc } = rpcRepo(null);

    await repository.replaceForPeriod('per-1', []);

    expect(rpc.mock.calls[0][1]).toEqual({
      p_period_id: 'per-1',
      p_budgets: [],
    });
  });

  it('turns 23505 into a ConflictError', async () => {
    const { repository } = rpcRepo(duplicate);

    await expect(
      repository.replaceForPeriod('per-1', [instance, instance]),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('keeps any other database error as is', async () => {
    const { repository } = rpcRepo({ code: 'XX000', message: 'rls' });

    await expect(repository.replaceForPeriod('per-1', [])).rejects.toThrow(
      'rls',
    );
  });
});
