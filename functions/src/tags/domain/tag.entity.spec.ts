import { Tag } from './tag.entity';

describe('Tag', () => {
  const base = { accountId: 'acc-1', name: 'Vacances', color: '#A1b2C3' };

  it('creates a tag with an id and timestamps', () => {
    const tag = Tag.create(base);

    expect(tag.id).toBeDefined();
    expect(tag.createdAt).toBeInstanceOf(Date);
    expect(tag.updatedAt).toEqual(tag.createdAt);
  });

  it.each(['', '   '])('rejects an empty name (%j)', (name) => {
    expect(() => Tag.create({ ...base, name })).toThrow('Tag name is required');
  });

  it.each(['red', '#abc', '#12345g', '123456', '#1234567'])(
    'rejects a color that is not a 6-digit hex (%s)',
    (color) => {
      expect(() => Tag.create({ ...base, color })).toThrow(
        'Invalid color format (hex required)',
      );
    },
  );

  // Comportement actuel : l'entité accepte un tag sans couleur ; c'est le DTO
  // HTTP qui l'exige (voir docs/tags.md, création à la volée).
  it('accepts an empty color at the domain level', () => {
    expect(Tag.create({ ...base, color: '' }).color).toBe('');
  });

  it('requires an account', () => {
    expect(() => Tag.create({ ...base, accountId: '' })).toThrow(
      'Account ID is required',
    );
  });
});
