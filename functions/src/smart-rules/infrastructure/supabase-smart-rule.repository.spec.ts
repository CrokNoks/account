import { SupabaseClient } from '@supabase/supabase-js';
import { ForbiddenError } from '../../shared/domain/errors';
import { SupabaseSmartRuleRepository } from './supabase-smart-rule.repository';

const repoWithDeleted = (rows: Array<{ id: string }>) => {
  const select = jest.fn().mockResolvedValue({ data: rows, error: null });
  const eq = jest.fn().mockReturnValue({ select });
  const del = jest.fn().mockReturnValue({ eq });
  const from = jest.fn().mockReturnValue({ delete: del });
  const repository = new SupabaseSmartRuleRepository({
    from,
  } as unknown as SupabaseClient);
  return { repository };
};

describe('SupabaseSmartRuleRepository.delete', () => {
  it('resolves when a row was deleted', async () => {
    const { repository } = repoWithDeleted([{ id: 'rule-1' }]);
    await expect(repository.delete('rule-1')).resolves.toBeUndefined();
  });

  it('throws ForbiddenError when no row was deleted (rule visible but write refused by RLS)', async () => {
    const { repository } = repoWithDeleted([]);
    await expect(repository.delete('rule-1')).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });
});
