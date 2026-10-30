import { GetBudgetBreakdownUseCase } from './get-budget-breakdown.use-case';
import { CategoryRepository } from '../../categories/domain/category.repository.interface';
import { TransactionRepository } from '../../transactions/domain/transaction.repository.interface';
import { BudgetRepository } from '../../budgets/domain/budget.repository.interface';
import { PeriodRepository } from '../../periods/domain/period.repository.interface';
import { Period } from '../../periods/domain/period.entity';
import {
  Category,
  CategoryType,
} from '../../categories/domain/category.entity';
import { BudgetInstance } from '../../budgets/domain/budget-instance.entity';
import { Transaction } from '../../transactions/domain/transaction.entity';

const category = (id: string, type: CategoryType) =>
  new Category({
    id,
    name: `Nom ${id}`,
    color: '#000000',
    type,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

const tx = (amount: number, categoryId: string | null) =>
  Transaction.create({
    accountId: 'acc-1',
    categoryId,
    date: new Date('2026-03-10'),
    description: 'tx',
    amount: BigInt(amount),
    reconciled: false,
    pending: false,
  });

const budget = (categoryId: string, amount: number) =>
  BudgetInstance.create({
    periodId: 'per-1',
    categoryId,
    amountAllocated: BigInt(amount),
  });

describe('GetBudgetBreakdownUseCase', () => {
  const period = Period.create({
    id: 'per-1',
    accountId: 'acc-1',
    startDate: new Date('2026-03-01'),
    endDate: null,
  });

  let periods: { findById: jest.Mock };
  let transactions: { findAllByAccountUnpaginated: jest.Mock };
  let budgets: { findAllByPeriod: jest.Mock };
  let categories: { findAllByAccount: jest.Mock };
  let useCase: GetBudgetBreakdownUseCase;

  beforeEach(() => {
    periods = { findById: jest.fn().mockResolvedValue(period) };
    categories = {
      findAllByAccount: jest
        .fn()
        .mockResolvedValue([
          category('salaire', CategoryType.INCOME),
          category('courses', CategoryType.EXPENSE),
          category('loisirs', CategoryType.EXPENSE),
          category('livret', CategoryType.SAVINGS),
          category('virement', CategoryType.TRANSFER),
        ]),
    };
    budgets = {
      findAllByPeriod: jest
        .fn()
        .mockResolvedValue([
          budget('salaire', 250000),
          budget('courses', 40000),
          budget('livret', 20000),
        ]),
    };
    transactions = {
      findAllByAccountUnpaginated: jest
        .fn()
        .mockResolvedValue([
          tx(250000, 'salaire'),
          tx(-30000, 'courses'),
          tx(-15000, 'courses'),
          tx(-2000, 'loisirs'),
          tx(-999, null),
        ]),
    };
    useCase = new GetBudgetBreakdownUseCase(
      categories as unknown as CategoryRepository,
      transactions as unknown as TransactionRepository,
      budgets as unknown as BudgetRepository,
      periods as unknown as PeriodRepository,
    );
  });

  it('groups categories by type', async () => {
    const result = await useCase.execute('acc-1', 'per-1');

    expect(result.income.map((c) => c.categoryId)).toEqual(['salaire']);
    expect(result.expenses.map((c) => c.categoryId)).toEqual([
      'courses',
      'loisirs',
    ]);
    expect(result.savings.map((c) => c.categoryId)).toEqual(['livret']);
    expect(result.transfers.map((c) => c.categoryId)).toEqual(['virement']);
  });

  it('loads only the transactions of the period (open-ended period)', async () => {
    await useCase.execute('acc-1', 'per-1');

    expect(transactions.findAllByAccountUnpaginated).toHaveBeenCalledWith(
      'acc-1',
      { startDate: period.startDate, endDate: undefined },
    );
  });

  it('computes real, remaining and percentage of an overspent expense budget', async () => {
    const { expenses } = await useCase.execute('acc-1', 'per-1');

    expect(expenses[0]).toEqual({
      categoryId: 'courses',
      name: 'Nom courses',
      real: '-45000',
      budget: '40000',
      remaining: '-5000',
      percentage: 113, // 112,5 % arrondi (half away from zero)
    });
  });

  it('returns 0 % and a negative remaining for an expense without budget', async () => {
    const { expenses } = await useCase.execute('acc-1', 'per-1');

    expect(expenses[1]).toMatchObject({
      real: '-2000',
      budget: '0',
      remaining: '-2000',
      percentage: 0,
    });
  });

  it('returns 0 real for a budgeted category without transactions', async () => {
    const { savings } = await useCase.execute('acc-1', 'per-1');

    expect(savings[0]).toMatchObject({
      real: '0',
      budget: '20000',
      remaining: '20000',
      percentage: 0,
    });
  });

  // Un revenu reçu en totalité n'a plus rien à percevoir : remaining = budget - real.
  it('computes income remaining as what is left to receive', async () => {
    const { income } = await useCase.execute('acc-1', 'per-1');

    expect(income[0]).toMatchObject({
      real: '250000',
      budget: '250000',
      remaining: '0',
      percentage: 100,
    });
  });

  it('computes the remaining of a partially received income and of a transfer like an income', async () => {
    budgets.findAllByPeriod.mockResolvedValue([
      budget('salaire', 300000),
      budget('virement', 10000),
    ]);
    transactions.findAllByAccountUnpaginated.mockResolvedValue([
      tx(250000, 'salaire'),
      tx(4000, 'virement'),
    ]);

    const { income, transfers } = await useCase.execute('acc-1', 'per-1');

    expect(income[0].remaining).toBe('50000');
    expect(transfers[0].remaining).toBe('6000');
  });

  it('rejects a period of another account like an unknown one', async () => {
    await expect(useCase.execute('acc-other', 'per-1')).rejects.toThrow(
      'Period not found',
    );
    expect(transactions.findAllByAccountUnpaginated).not.toHaveBeenCalled();
  });

  it('rejects an unknown period', async () => {
    periods.findById.mockResolvedValue(null);

    await expect(useCase.execute('acc-1', 'per-1')).rejects.toThrow(
      'Period not found',
    );
  });
});
