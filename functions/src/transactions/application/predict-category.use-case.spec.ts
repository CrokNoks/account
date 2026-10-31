import { PredictCategoryUseCase } from './predict-category.use-case';
import { TransactionRepository } from '../domain/transaction.repository.interface';
import { MatchSmartRulesUseCase } from '../../smart-rules/application/match-smart-rules.use-case';
import { Transaction } from '../domain/transaction.entity';

describe('PredictCategoryUseCase', () => {
  let repository: { findAllByAccountUnpaginated: jest.Mock };
  let matchRules: { execute: jest.Mock };
  let useCase: PredictCategoryUseCase;

  const history = (description: string, categoryId: string | null) =>
    Transaction.create({
      accountId: 'acc-1',
      categoryId,
      date: new Date('2026-03-01'),
      description,
      amount: BigInt(-100),
      reconciled: false,
      pending: false,
    });

  beforeEach(() => {
    repository = {
      findAllByAccountUnpaginated: jest.fn().mockResolvedValue([]),
    };
    matchRules = {
      execute: jest.fn().mockResolvedValue({ categoryId: null, tagIds: [] }),
    };
    useCase = new PredictCategoryUseCase(
      repository as unknown as TransactionRepository,
      matchRules as unknown as MatchSmartRulesUseCase,
    );
  });

  it.each(['', '  ', 'ab', ' ab '])(
    'returns no category for a description shorter than 3 characters (%j)',
    async (description) => {
      expect(await useCase.execute('acc-1', description)).toEqual({
        categoryId: null,
      });
      expect(matchRules.execute).not.toHaveBeenCalled();
    },
  );

  it('prefers a matching smart rule over history', async () => {
    matchRules.execute.mockResolvedValue({
      categoryId: 'cat-rule',
      tagIds: ['tag-1'],
    });

    const result = await useCase.execute('acc-1', 'NETFLIX');

    expect(result).toEqual({ categoryId: 'cat-rule', tagIds: ['tag-1'] });
    expect(repository.findAllByAccountUnpaginated).not.toHaveBeenCalled();
  });

  it('returns rule tags even when the rule sets no category', async () => {
    matchRules.execute.mockResolvedValue({
      categoryId: null,
      tagIds: ['tag-1'],
    });

    expect(await useCase.execute('acc-1', 'NETFLIX')).toEqual({
      categoryId: null,
      tagIds: ['tag-1'],
    });
  });

  it('returns no category when there is no categorized history', async () => {
    repository.findAllByAccountUnpaginated.mockResolvedValue([
      history('carrefour', null),
    ]);

    expect(await useCase.execute('acc-1', 'carrefour market')).toEqual({
      categoryId: null,
    });
  });

  it('returns no category when no word of the description was ever seen', async () => {
    repository.findAllByAccountUnpaginated.mockResolvedValue([
      history('cb carrefour market', 'cat-courses'),
      history('cb carrefour city', 'cat-courses'),
      history('sncf billet train', 'cat-transport'),
    ]);

    expect(await useCase.execute('acc-1', 'zzz inconnu')).toEqual({
      categoryId: null,
    });
  });

  describe('CA1 — accents and case have no effect', () => {
    beforeEach(() => {
      repository.findAllByAccountUnpaginated.mockResolvedValue([
        history('Électricité de France', 'cat-energie'),
        history('sncf billet train', 'cat-transport'),
        history('sncf voyage paris', 'cat-transport'),
      ]);
    });

    it.each(['electricite edf', 'ÉLECTRICITÉ'])(
      'finds Énergie for %j',
      async (d) => {
        expect((await useCase.execute('acc-1', d)).categoryId).toBe(
          'cat-energie',
        );
      },
    );
  });

  it('CA2 — close French forms are the same word', async () => {
    repository.findAllByAccountUnpaginated.mockResolvedValue([
      history('abonnement mobile', 'cat-telecom'),
      history('sncf billet train', 'cat-transport'),
      history('sncf voyage paris', 'cat-transport'),
    ]);

    expect((await useCase.execute('acc-1', 'abonnements')).categoryId).toBe(
      'cat-telecom',
    );
  });

  describe('CA3 — operation type, card, date and references do not matter', () => {
    const resto = (n: number) =>
      history(
        `Paiement par carte\nX2909 Snack${'abcdefghij'[n]} 1${n}/10 - Snack${'abcdefghij'[n]}`,
        'cat-resto',
      );

    it('predicts Courses for another card and date', async () => {
      repository.findAllByAccountUnpaginated.mockResolvedValue([
        history(
          'Paiement par carte\nX2909 E.Leclerc 24/10 - E.Leclerc',
          'cat-courses',
        ),
        resto(1),
        resto(2),
        resto(3),
        resto(4),
      ]);

      const result = await useCase.execute(
        'acc-1',
        'Paiement par carte\nX0053 E.Leclerc 03/11 - E.Leclerc',
      );

      expect(result.categoryId).toBe('cat-courses');
    });

    it('ignores SEPA identifiers and references', async () => {
      repository.findAllByAccountUnpaginated.mockResolvedValue([
        history(
          'Prélèvement SEPA EDF\nRéf FR12ZZZ123456 D12-3456789',
          'cat-energie',
        ),
        history(
          'Prélèvement SEPA Autre\nRéf FR12ZZZ123456 D12-3456789',
          'cat-autre',
        ),
        history(
          'Prélèvement SEPA Autre\nRéf FR12ZZZ123456 D12-3456789',
          'cat-autre',
        ),
        history(
          'Prélèvement SEPA Autre\nRéf FR12ZZZ123456 D12-3456789',
          'cat-autre',
        ),
      ]);

      const result = await useCase.execute(
        'acc-1',
        'Prélèvement SEPA EDF\nRéf FR99ZZZ987654 D98-7654321',
      );

      expect(result.categoryId).toBe('cat-energie');
    });
  });

  describe('CA4 — only noise words are known', () => {
    it('proposes nothing for a label made of noise only', async () => {
      repository.findAllByAccountUnpaginated.mockResolvedValue([
        history('Paiement par carte X2909 E.Leclerc 24/10', 'cat-courses'),
        history('Paiement par carte X2909 Snack 25/10', 'cat-resto'),
      ]);

      expect(
        await useCase.execute('acc-1', 'Paiement par carte X1234 12/10'),
      ).toEqual({ categoryId: null });
    });
  });

  it('CA5 — proposes the best candidate as soon as one useful word is known', async () => {
    repository.findAllByAccountUnpaginated.mockResolvedValue([
      history('leclerc', 'cat-courses'),
      ...Array.from({ length: 5 }, () =>
        history('boulangerie pain', 'cat-resto'),
      ),
    ]);

    const result = await useCase.execute(
      'acc-1',
      'leclerc mot1inconnu truc machin chose bidule',
    );

    expect(result.categoryId).not.toBeNull();
  });

  it('CA6 — a matching smart rule wins and history is not read', async () => {
    matchRules.execute.mockResolvedValue({
      categoryId: 'cat-rule',
      tagIds: [],
    });
    repository.findAllByAccountUnpaginated.mockResolvedValue([
      history('Électricité de France', 'cat-energie'),
    ]);

    const result = await useCase.execute('acc-1', 'electricite edf');

    expect(result).toEqual({ categoryId: 'cat-rule', tagIds: [] });
    expect(repository.findAllByAccountUnpaginated).not.toHaveBeenCalled();
  });

  it('ignores history rows whose description holds nothing but noise', async () => {
    repository.findAllByAccountUnpaginated.mockResolvedValue([
      history('Paiement par carte X2909 12/10', 'cat-resto'),
      history('Paiement par carte X2909 13/10', 'cat-resto'),
      history('Spotify', 'cat-loisirs'),
    ]);

    expect((await useCase.execute('acc-1', 'Spotify premium')).categoryId).toBe(
      'cat-loisirs',
    );
  });

  it('predicts the category from similar past transactions', async () => {
    repository.findAllByAccountUnpaginated.mockResolvedValue([
      history('cb carrefour market', 'cat-courses'),
      history('cb carrefour city', 'cat-courses'),
      history('sncf billet train', 'cat-transport'),
      history('sncf voyage paris', 'cat-transport'),
    ]);

    expect((await useCase.execute('acc-1', 'CB CARREFOUR')).categoryId).toBe(
      'cat-courses',
    );
    expect((await useCase.execute('acc-1', 'SNCF BILLET')).categoryId).toBe(
      'cat-transport',
    );
  });
  describe('executeMany', () => {
    beforeEach(() => {
      repository.findAllByAccountUnpaginated.mockResolvedValue([
        history('Électricité de France', 'cat-energie'),
        history('sncf billet train', 'cat-transport'),
        history('sncf voyage paris', 'cat-transport'),
      ]);
    });

    it('returns one prediction per description, identical to the single one', async () => {
      const descriptions = [
        'electricite edf',
        'SNCF BILLET',
        'zzz inconnu',
        'ab',
      ];

      const many = await useCase.executeMany('acc-1', descriptions);
      const single: Awaited<ReturnType<typeof useCase.execute>>[] = [];
      for (const d of descriptions) {
        single.push(await useCase.execute('acc-1', d));
      }

      expect(many).toEqual(single);
      expect(many.map((r) => r.categoryId)).toEqual([
        'cat-energie',
        'cat-transport',
        null,
        null,
      ]);
    });

    it('reads the history once whatever the number of descriptions', async () => {
      repository.findAllByAccountUnpaginated.mockClear();

      await useCase.executeMany('acc-1', ['edf', 'sncf', 'train', 'paris']);

      expect(repository.findAllByAccountUnpaginated).toHaveBeenCalledTimes(1);
    });

    it('keeps smart rules first, line by line', async () => {
      matchRules.execute.mockImplementation((_a: string, d: string) =>
        Promise.resolve(
          d === 'NETFLIX'
            ? { categoryId: 'cat-rule', tagIds: ['t1'] }
            : { categoryId: null, tagIds: [] },
        ),
      );

      const result = await useCase.executeMany('acc-1', [
        'NETFLIX',
        'SNCF BILLET',
      ]);

      expect(result).toEqual([
        { categoryId: 'cat-rule', tagIds: ['t1'] },
        { categoryId: 'cat-transport' },
      ]);
    });

    it('does not read the history when every line is solved by a rule', async () => {
      matchRules.execute.mockResolvedValue({ categoryId: 'c', tagIds: [] });
      repository.findAllByAccountUnpaginated.mockClear();

      await useCase.executeMany('acc-1', ['NETFLIX', 'SPOTIFY']);

      expect(repository.findAllByAccountUnpaginated).not.toHaveBeenCalled();
    });
  });
});
