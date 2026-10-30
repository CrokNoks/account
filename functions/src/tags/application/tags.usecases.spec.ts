import { NotFoundError } from '../../shared/domain/errors';
import { CreateTagUseCase } from './create-tag.usecase';
import { DeleteTagUseCase } from './delete-tag.usecase';
import { FindAccountTagsUseCase } from './find-account-tags.usecase';
import { UpdateTagUseCase } from './update-tag.usecase';
import { TagRepository } from '../domain/tag.repository.interface';
import { Tag } from '../domain/tag.entity';

describe('Tags use cases', () => {
  let repository: jest.Mocked<TagRepository>;

  const existing = Tag.create({
    id: 'tag-1',
    accountId: 'acc-1',
    name: 'Vacances',
    color: '#111111',
    createdAt: new Date('2026-01-01'),
  });

  beforeEach(() => {
    repository = {
      findAllByAccount: jest.fn(),
      findById: jest.fn().mockResolvedValue(existing),
      save: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    };
  });

  it('creates and saves a tag', async () => {
    const tag = await new CreateTagUseCase(repository).execute({
      accountId: 'acc-1',
      name: 'Courses',
      color: '#22c55e',
    });

    expect(tag).toMatchObject({
      accountId: 'acc-1',
      name: 'Courses',
      color: '#22c55e',
    });
    expect(repository.save).toHaveBeenCalledWith(tag);
  });

  it('applies the default color when none is given', async () => {
    const tag = await new CreateTagUseCase(repository).execute({
      accountId: 'acc-1',
      name: 'Vacances',
    });

    expect(tag.color).toBe('#94a3b8');
    expect(repository.save).toHaveBeenCalledWith(tag);
  });

  it('does not save an invalid tag', async () => {
    await expect(
      new CreateTagUseCase(repository).execute({
        accountId: 'acc-1',
        name: 'Courses',
        color: 'green',
      }),
    ).rejects.toThrow('Invalid color format');
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('lists the tags of an account', async () => {
    repository.findAllByAccount.mockResolvedValue([existing]);

    expect(
      await new FindAccountTagsUseCase(repository).execute('acc-1'),
    ).toEqual([existing]);
    expect(repository.findAllByAccount).toHaveBeenCalledWith('acc-1');
  });

  it('deletes a tag by id', async () => {
    await new DeleteTagUseCase(repository).execute('tag-1');

    expect(repository.delete).toHaveBeenCalledWith('tag-1');
  });

  describe('UpdateTagUseCase', () => {
    it('updates name and color, keeping id, account and creation date', async () => {
      const updated = await new UpdateTagUseCase(repository).execute({
        id: 'tag-1',
        name: 'Voyages',
        color: '#222222',
      });

      expect(updated).toMatchObject({
        id: 'tag-1',
        accountId: 'acc-1',
        name: 'Voyages',
        color: '#222222',
        createdAt: new Date('2026-01-01'),
      });
      expect(updated.updatedAt.getTime()).toBeGreaterThan(
        existing.createdAt.getTime(),
      );
      expect(repository.save).toHaveBeenCalledWith(updated);
    });

    it('keeps fields that are not provided', async () => {
      const updated = await new UpdateTagUseCase(repository).execute({
        id: 'tag-1',
      });

      expect(updated).toMatchObject({ name: 'Vacances', color: '#111111' });
    });

    it('throws NotFoundError for an unknown tag', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        new UpdateTagUseCase(repository).execute({ id: 'nope' }),
      ).rejects.toBeInstanceOf(NotFoundError);
      expect(repository.save).not.toHaveBeenCalled();
    });
  });
});
