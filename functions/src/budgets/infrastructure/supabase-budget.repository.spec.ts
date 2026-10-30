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
  it.each(['save', 'saveBulk'] as const)(
    '%s turns 23505 into a ConflictError',
    async (method) => {
      const repository = repoWith(duplicate);
      const result =
        method === 'save'
          ? repository.save(instance)
          : repository.saveBulk([instance, instance]);
      await expect(result).rejects.toBeInstanceOf(ConflictError);
    },
  );

  it('keeps any other database error as is', async () => {
    const result = repoWith({ code: '42P01', message: 'boom' }).saveBulk([
      instance,
    ]);
    await expect(result).rejects.not.toBeInstanceOf(ConflictError);
    await expect(result).rejects.toThrow('boom');
  });
});
