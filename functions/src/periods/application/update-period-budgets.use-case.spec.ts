import { UpdatePeriodBudgetsUseCase } from './update-period-budgets.use-case';
import { BudgetRepository } from '../../budgets/domain/budget.repository.interface';
import { BudgetInstance } from '../../budgets/domain/budget-instance.entity';
import { AccountReferencesService } from '../../shared/application/account-references.service';
import { DomainValidationError } from '../../shared/domain/errors';

describe('UpdatePeriodBudgetsUseCase', () => {
  let repository: { deleteAllByPeriod: jest.Mock; saveBulk: jest.Mock };
  let useCase: UpdatePeriodBudgetsUseCase;
  let calls: string[];
  let refs: { ensureCategories: jest.Mock };

  beforeEach(() => {
    calls = [];
    repository = {
      deleteAllByPeriod: jest.fn(() => {
        calls.push('delete');
        return Promise.resolve();
      }),
      saveBulk: jest.fn(() => {
        calls.push('save');
        return Promise.resolve();
      }),
    };
    refs = { ensureCategories: jest.fn().mockResolvedValue(undefined) };
    useCase = new UpdatePeriodBudgetsUseCase(
      repository as unknown as BudgetRepository,
      refs as unknown as AccountReferencesService,
    );
  });

  it('replaces the budgets of the period: delete all, then save the new ones', async () => {
    const result = await useCase.execute({
      accountId: 'acc-1',
      periodId: 'per-1',
      budgets: [
        { categoryId: 'cat-courses', amountAllocated: BigInt(-40000) },
        { categoryId: 'cat-salaire', amountAllocated: BigInt(250000) },
      ],
    });

    expect(calls).toEqual(['delete', 'save']);
    expect(repository.deleteAllByPeriod).toHaveBeenCalledWith('per-1');
    expect(result).toHaveLength(2);
    expect(result.every((b) => b instanceof BudgetInstance)).toBe(true);
    expect(result.every((b) => b.periodId === 'per-1')).toBe(true);
    expect(repository.saveBulk).toHaveBeenCalledWith(result);
  });

  it('drops budgets allocated to 0', async () => {
    const result = await useCase.execute({
      accountId: 'acc-1',
      periodId: 'per-1',
      budgets: [
        { categoryId: 'cat-a', amountAllocated: BigInt(0) },
        { categoryId: 'cat-b', amountAllocated: BigInt(-100) },
      ],
    });

    expect(result.map((b) => b.categoryId)).toEqual(['cat-b']);
  });

  it('only deletes when every budget is 0 or the list is empty', async () => {
    const result = await useCase.execute({
      accountId: 'acc-1',
      periodId: 'per-1',
      budgets: [{ categoryId: 'cat-a', amountAllocated: BigInt(0) }],
    });

    expect(result).toEqual([]);
    expect(repository.deleteAllByPeriod).toHaveBeenCalledWith('per-1');
    expect(repository.saveBulk).not.toHaveBeenCalled();
  });

  // Comportement actuel documenté (docs/periods.md) : remplacement non atomique.
  it('leaves the period without budgets when saving fails after the delete', async () => {
    repository.saveBulk.mockRejectedValue(new Error('db down'));

    await expect(
      useCase.execute({
        accountId: 'acc-1',
        periodId: 'per-1',
        budgets: [{ categoryId: 'cat-a', amountAllocated: BigInt(-100) }],
      }),
    ).rejects.toThrow('db down');
    expect(repository.deleteAllByPeriod).toHaveBeenCalled();
  });

  it('refuses a category of another account before deleting anything', async () => {
    refs.ensureCategories.mockRejectedValue(
      new DomainValidationError('Category does not belong to this account'),
    );

    await expect(
      useCase.execute({
        accountId: 'acc-1',
        periodId: 'per-1',
        budgets: [{ categoryId: 'cat-foreign', amountAllocated: BigInt(-100) }],
      }),
    ).rejects.toBeInstanceOf(DomainValidationError);
    expect(refs.ensureCategories).toHaveBeenCalledWith('acc-1', [
      'cat-foreign',
    ]);
    expect(repository.deleteAllByPeriod).not.toHaveBeenCalled();
    expect(repository.saveBulk).not.toHaveBeenCalled();
  });
});
