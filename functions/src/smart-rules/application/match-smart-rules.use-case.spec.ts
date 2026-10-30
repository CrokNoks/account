import { MatchSmartRulesUseCase } from './match-smart-rules.use-case';
import { SmartRule } from '../domain/smart-rule.entity';
import type { SmartRuleRepository } from '../domain/smart-rule.repository.interface';

describe('MatchSmartRulesUseCase', () => {
  let repository: jest.Mocked<SmartRuleRepository>;
  let useCase: MatchSmartRulesUseCase;

  const rule = (
    pattern: string,
    priority: number,
    categoryId: string,
    tagIds: string[] = [],
  ) =>
    SmartRule.create({
      accountId: 'acc-1',
      pattern,
      priority,
      categoryId,
      tagIds,
    });

  beforeEach(() => {
    repository = {
      findAllByAccount: jest.fn(),
      findById: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    useCase = new MatchSmartRulesUseCase(repository);
  });

  it('returns the category and tags of the matching rule', async () => {
    repository.findAllByAccount.mockResolvedValue([
      rule('netflix', 0, 'cat-loisirs', ['tag-abo']),
    ]);

    const result = await useCase.execute('acc-1', 'PRLV NETFLIX.COM');

    expect(repository.findAllByAccount).toHaveBeenCalledWith('acc-1');
    expect(result).toEqual({ categoryId: 'cat-loisirs', tagIds: ['tag-abo'] });
  });

  it('applies the highest priority rule when several match', async () => {
    repository.findAllByAccount.mockResolvedValue([
      rule('carrefour', 1, 'cat-courses'),
      rule('carrefour essence', 10, 'cat-carburant'),
    ]);

    const result = await useCase.execute('acc-1', 'CB CARREFOUR ESSENCE');

    expect(result.categoryId).toBe('cat-carburant');
  });

  it('returns an empty match when no rule matches', async () => {
    repository.findAllByAccount.mockResolvedValue([
      rule('netflix', 0, 'cat-1'),
    ]);

    const result = await useCase.execute('acc-1', 'BOULANGERIE');

    expect(result).toEqual({ categoryId: null, tagIds: [] });
  });

  it('returns an empty match when the account has no rules', async () => {
    repository.findAllByAccount.mockResolvedValue([]);

    expect(await useCase.execute('acc-1', 'anything')).toEqual({
      categoryId: null,
      tagIds: [],
    });
  });
});
