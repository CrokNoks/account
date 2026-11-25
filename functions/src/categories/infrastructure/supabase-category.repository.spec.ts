import { SupabaseClient } from '@supabase/supabase-js';
import { ForbiddenError, NotFoundError } from '../../shared/domain/errors';
import { SupabaseCategoryRepository } from './supabase-category.repository';

const row = {
  id: 'cat-1',
  name: 'Salaire',
  description: null,
  color: '#112233',
  type: 'income',
  account_id: 'acc-1',
  user_id: 'u1',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

describe('SupabaseCategoryRepository (period trigger)', () => {
  it('reads is_period_trigger, and false when the column does not exist yet (migration not applied)', async () => {
    const select = jest.fn().mockReturnValue({
      eq: () => ({
        returns: () =>
          Promise.resolve({
            data: [row, { ...row, id: 'cat-2', is_period_trigger: true }],
            error: null,
          }),
      }),
    });
    const repository = new SupabaseCategoryRepository({
      from: () => ({ select }),
    } as unknown as SupabaseClient);

    const [absent, marked] = await repository.findAllByAccount('acc-1');

    expect(absent.isPeriodTrigger).toBe(false);
    expect(marked.isPeriodTrigger).toBe(true);
  });

  it('sets the mark through set_period_trigger_category (one atomic call)', async () => {
    const rpc = jest.fn().mockResolvedValue({ error: null });
    const repository = new SupabaseCategoryRepository({
      rpc,
    } as unknown as SupabaseClient);

    await repository.setPeriodTrigger('cat-1', true);

    expect(rpc).toHaveBeenCalledWith('set_period_trigger_category', {
      p_category_id: 'cat-1',
      p_value: true,
    });
  });

  it('maps an invisible category (P0002) to 404 and a read-only member (42501) to 403', async () => {
    const failing = (code: string) =>
      new SupabaseCategoryRepository({
        rpc: jest.fn().mockResolvedValue({ error: { code, message: 'x' } }),
      } as unknown as SupabaseClient);

    await expect(
      failing('P0002').setPeriodTrigger('cat-1', true),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      failing('42501').setPeriodTrigger('cat-1', true),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
