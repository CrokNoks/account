import { UpdatePeriodBudgetsUseCase } from './update-period-budgets.use-case';
import { BudgetRepository } from '../../budgets/domain/budget.repository.interface';
import { BudgetInstance } from '../../budgets/domain/budget-instance.entity';

describe('UpdatePeriodBudgetsUseCase', () => {
  let repository: { deleteAllByPeriod: jest.Mock; saveBulk: jest.Mock };
  let useCase: UpdatePeriodBudgetsUseCase;
  let calls: string[];

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
    useCase = new UpdatePeriodBudgetsUseCase(
      repository as unknown as BudgetRepository,
    );
  });

  it('replaces the budgets of the period: delete all, then save the new ones', async () => {
    const result = await useCase.execute({
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
        periodId: 'per-1',
        budgets: [{ categoryId: 'cat-a', amountAllocated: BigInt(-100) }],
      }),
    ).rejects.toThrow('db down');
    expect(repository.deleteAllByPeriod).toHaveBeenCalled();
  });
});
