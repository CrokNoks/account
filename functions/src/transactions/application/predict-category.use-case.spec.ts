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

  it('compares words after stemming, like the classifier', async () => {
    repository.findAllByAccountUnpaginated.mockResolvedValue([
      history('monthly subscriptions', 'cat-abo'),
      history('sncf billet train', 'cat-transport'),
      history('sncf voyage paris', 'cat-transport'),
    ]);

    expect((await useCase.execute('acc-1', 'subscription')).categoryId).toBe(
      'cat-abo',
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
});
