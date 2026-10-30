import { SupabaseClient } from '@supabase/supabase-js';
import { ConflictError } from '../../shared/domain/errors';
import { Tag } from '../domain/tag.entity';
import { SupabaseTagRepository } from './supabase-tag.repository';

const tag = Tag.create({
  accountId: 'acc-1',
  name: 'Vacances',
  color: '#ff0000',
});

const repoWith = (error: { code?: string; message: string } | null) => {
  const upsert = jest.fn().mockResolvedValue({ error });
  const supabase = { from: jest.fn().mockReturnValue({ upsert }) };
  return {
    repository: new SupabaseTagRepository(
      supabase as unknown as SupabaseClient,
    ),
    supabase,
  };
};

describe('SupabaseTagRepository.save', () => {
  it('saves a tag', async () => {
    const { repository, supabase } = repoWith(null);
    await expect(repository.save(tag)).resolves.toBeUndefined();
    expect(supabase.from).toHaveBeenCalledWith('tags');
  });

  it('turns the unique violation (23505) of the tag name into a ConflictError', async () => {
    const { repository } = repoWith({
      code: '23505',
      message:
        'duplicate key value violates unique constraint "tags_account_id_name_key"',
    });
    const result = repository.save(tag);
    await expect(result).rejects.toBeInstanceOf(ConflictError);
    await expect(result).rejects.toThrow('A tag with this name already exists');
  });

  it('keeps any other database error as is', async () => {
    const { repository } = repoWith({ code: '42P01', message: 'boom' });
    const result = repository.save(tag);
    await expect(result).rejects.not.toBeInstanceOf(ConflictError);
    await expect(result).rejects.toThrow('boom');
  });
});
