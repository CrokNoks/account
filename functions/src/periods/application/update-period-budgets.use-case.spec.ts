import { UpdatePeriodBudgetsUseCase } from './update-period-budgets.use-case';
import { BudgetRepository } from '../../budgets/domain/budget.repository.interface';
import { BudgetInstance } from '../../budgets/domain/budget-instance.entity';
import { AccountReferencesService } from '../../shared/application/account-references.service';
import {
  BudgetsChangedError,
  DomainValidationError,
} from '../../shared/domain/errors';

describe('UpdatePeriodBudgetsUseCase', () => {
  let repository: {
    replaceForPeriod: jest.Mock;
  };
  let useCase: UpdatePeriodBudgetsUseCase;
  let refs: { ensureCategories: jest.Mock };

  beforeEach(() => {
    repository = {
      replaceForPeriod: jest.fn().mockResolvedValue(undefined),
    };
    refs = { ensureCategories: jest.fn().mockResolvedValue(undefined) };
    useCase = new UpdatePeriodBudgetsUseCase(
      repository as unknown as BudgetRepository,
      refs as unknown as AccountReferencesService,
    );
  });

  it('replaces the budgets of the period in one atomic call', async () => {
    const result = await useCase.execute({
      accountId: 'acc-1',
      periodId: 'per-1',
      budgets: [
        { categoryId: 'cat-courses', amountAllocated: BigInt(-40000) },
        { categoryId: 'cat-salaire', amountAllocated: BigInt(250000) },
      ],
    });

    expect(repository.replaceForPeriod).toHaveBeenCalledTimes(1);
    expect(repository.replaceForPeriod).toHaveBeenCalledWith('per-1', result);
    expect(result).toHaveLength(2);
    expect(result.every((b) => b instanceof BudgetInstance)).toBe(true);
    expect(result.every((b) => b.periodId === 'per-1')).toBe(true);
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
    expect(repository.replaceForPeriod).toHaveBeenCalledWith('per-1', result);
  });

  it('replaces with an empty list when every budget is 0', async () => {
    const result = await useCase.execute({
      accountId: 'acc-1',
      periodId: 'per-1',
      budgets: [{ categoryId: 'cat-a', amountAllocated: BigInt(0) }],
    });

    expect(result).toEqual([]);
    expect(repository.replaceForPeriod).toHaveBeenCalledWith('per-1', []);
  });

  it('propagates the error of the atomic call; no separate delete or insert', async () => {
    repository.replaceForPeriod.mockRejectedValue(new Error('db down'));

    await expect(
      useCase.execute({
        accountId: 'acc-1',
        periodId: 'per-1',
        budgets: [{ categoryId: 'cat-a', amountAllocated: BigInt(-100) }],
      }),
    ).rejects.toThrow('db down');
    expect(repository.replaceForPeriod).toHaveBeenCalledTimes(1);
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
    expect(repository.replaceForPeriod).not.toHaveBeenCalled();
  });

  describe('expectedBudgets (concurrent change)', () => {
    it('does not send any expectation when expectedBudgets is absent', async () => {
      await useCase.execute({
        accountId: 'acc-1',
        periodId: 'per-1',
        budgets: [{ categoryId: 'cat-a', amountAllocated: BigInt(-100) }],
      });

      expect(repository.replaceForPeriod).toHaveBeenCalledWith(
        'per-1',
        expect.any(Array),
      );
      expect(repository.replaceForPeriod.mock.calls[0]).toHaveLength(2);
    });

    it('forwards the expected budgets without the ones at 0', async () => {
      await useCase.execute({
        accountId: 'acc-1',
        periodId: 'per-1',
        budgets: [{ categoryId: 'cat-a', amountAllocated: BigInt(-100) }],
        expectedBudgets: [
          { categoryId: 'cat-a', amountAllocated: BigInt(-90) },
          { categoryId: 'cat-b', amountAllocated: BigInt(0) },
        ],
      });

      expect(repository.replaceForPeriod).toHaveBeenCalledWith(
        'per-1',
        expect.any(Array),
        [{ categoryId: 'cat-a', amountAllocated: BigInt(-90) }],
      );
    });

    it('an empty expected list is a value: it is forwarded', async () => {
      await useCase.execute({
        accountId: 'acc-1',
        periodId: 'per-1',
        budgets: [],
        expectedBudgets: [],
      });

      expect(repository.replaceForPeriod).toHaveBeenCalledWith('per-1', [], []);
    });

    it('propagates BudgetsChangedError', async () => {
      repository.replaceForPeriod.mockRejectedValue(new BudgetsChangedError());

      await expect(
        useCase.execute({
          accountId: 'acc-1',
          periodId: 'per-1',
          budgets: [],
          expectedBudgets: [],
        }),
      ).rejects.toBeInstanceOf(BudgetsChangedError);
    });
  });
});
