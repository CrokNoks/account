import { SaveBudgetTemplatesUseCase } from './save-budget-templates.use-case';
import { BudgetRepository } from '../../budgets/domain/budget.repository.interface';
import { AccountReferencesService } from '../../shared/application/account-references.service';
import { DomainValidationError } from '../../shared/domain/errors';

describe('SaveBudgetTemplatesUseCase', () => {
  let repository: { saveTemplates: jest.Mock };
  let refs: { ensureCategories: jest.Mock };
  let useCase: SaveBudgetTemplatesUseCase;

  beforeEach(() => {
    repository = { saveTemplates: jest.fn().mockResolvedValue(undefined) };
    refs = { ensureCategories: jest.fn().mockResolvedValue(undefined) };
    useCase = new SaveBudgetTemplatesUseCase(
      repository as unknown as BudgetRepository,
      refs as unknown as AccountReferencesService,
    );
  });

  it('writes all lines in one call after checking the categories', async () => {
    const items = [
      { categoryId: 'cat-a', amount: BigInt(50000) },
      { categoryId: 'cat-b', amount: BigInt(-8000) },
    ];

    await useCase.execute({ accountId: 'acc-1', items });

    expect(refs.ensureCategories).toHaveBeenCalledWith('acc-1', [
      'cat-a',
      'cat-b',
    ]);
    expect(repository.saveTemplates).toHaveBeenCalledTimes(1);
    expect(repository.saveTemplates).toHaveBeenCalledWith('acc-1', items);
  });

  it('writes nothing when a category is gone or foreign (whole batch refused)', async () => {
    refs.ensureCategories.mockRejectedValue(
      new DomainValidationError('Category does not belong to this account'),
    );

    await expect(
      useCase.execute({
        accountId: 'acc-1',
        items: [
          { categoryId: 'cat-a', amount: BigInt(1) },
          { categoryId: 'cat-deleted', amount: BigInt(2) },
        ],
      }),
    ).rejects.toBeInstanceOf(DomainValidationError);
    expect(repository.saveTemplates).not.toHaveBeenCalled();
  });

  it('refuses a duplicated category without writing', async () => {
    await expect(
      useCase.execute({
        accountId: 'acc-1',
        items: [
          { categoryId: 'cat-a', amount: BigInt(1) },
          { categoryId: 'cat-a', amount: BigInt(2) },
        ],
      }),
    ).rejects.toBeInstanceOf(DomainValidationError);
    expect(repository.saveTemplates).not.toHaveBeenCalled();
  });

  it('keeps a category added meanwhile out of the write (absent = untouched)', async () => {
    await useCase.execute({
      accountId: 'acc-1',
      items: [{ categoryId: 'cat-a', amount: BigInt(1) }],
    });

    expect(repository.saveTemplates).toHaveBeenCalledWith('acc-1', [
      { categoryId: 'cat-a', amount: BigInt(1) },
    ]);
  });
});
