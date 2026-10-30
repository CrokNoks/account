import { GetPeriodStatsUseCase } from './get-period-stats.use-case';
import { AccountRepository } from '../../accounts/domain/account.repository.interface';
import { PeriodRepository } from '../../periods/domain/period.repository.interface';
import { TransactionRepository } from '../../transactions/domain/transaction.repository.interface';
import { BudgetRepository } from '../../budgets/domain/budget.repository.interface';
import { CategoryRepository } from '../../categories/domain/category.repository.interface';
import { Account } from '../../accounts/domain/account.entity';
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
    name: id,
    color: '#000000',
    type,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

const tx = (
  amount: number,
  categoryId: string | null,
  flags: { reconciled?: boolean; pending?: boolean } = {},
) =>
  Transaction.create({
    accountId: 'acc-1',
    categoryId,
    date: new Date('2026-03-10'),
    description: 'tx',
    amount: BigInt(amount),
    reconciled: flags.reconciled ?? false,
    pending: flags.pending ?? false,
  });

describe('GetPeriodStatsUseCase', () => {
  const period = Period.create({
    id: 'per-1',
    accountId: 'acc-1',
    startDate: new Date('2026-03-01'),
    endDate: new Date('2026-03-31'),
  });

  let accounts: { findById: jest.Mock };
  let periods: { findById: jest.Mock };
  let transactions: {
    sumAmountByAccountBeforeDate: jest.Mock;
    findAllByAccountUnpaginated: jest.Mock;
  };
  let budgets: { findAllByPeriod: jest.Mock };
  let categories: { findAllByAccount: jest.Mock };
  let useCase: GetPeriodStatsUseCase;

  beforeEach(() => {
    accounts = {
      findById: jest.fn().mockResolvedValue(
        new Account({
          id: 'acc-1',
          name: 'Courant',
          ownerId: 'u-1',
          initialBalance: BigInt(100000),
        }),
      ),
    };
    periods = { findById: jest.fn().mockResolvedValue(period) };
    transactions = {
      sumAmountByAccountBeforeDate: jest.fn().mockResolvedValue(BigInt(20000)),
      findAllByAccountUnpaginated: jest
        .fn()
        .mockResolvedValue([
          tx(250000, 'salaire', { reconciled: true }),
          tx(-30000, 'courses', { reconciled: true }),
          tx(-15000, 'courses', { pending: true }),
          tx(-5000, null),
          tx(10000, 'virement'),
        ]),
    };
    budgets = {
      findAllByPeriod: jest.fn().mockResolvedValue([
        BudgetInstance.create({
          periodId: 'per-1',
          categoryId: 'salaire',
          amountAllocated: BigInt(250000),
        }),
        BudgetInstance.create({
          periodId: 'per-1',
          categoryId: 'courses',
          amountAllocated: BigInt(40000),
        }),
      ]),
    };
    categories = {
      findAllByAccount: jest
        .fn()
        .mockResolvedValue([
          category('salaire', CategoryType.INCOME),
          category('courses', CategoryType.EXPENSE),
          category('virement', CategoryType.TRANSFER),
          category('epargne', CategoryType.SAVINGS),
        ]),
    };
    useCase = new GetPeriodStatsUseCase(
      accounts as unknown as AccountRepository,
      periods as unknown as PeriodRepository,
      transactions as unknown as TransactionRepository,
      budgets as unknown as BudgetRepository,
      categories as unknown as CategoryRepository,
    );
  });

  it('computes the start balance from the initial balance and transactions before the period', async () => {
    const stats = await useCase.execute('acc-1', 'per-1');

    expect(transactions.sumAmountByAccountBeforeDate).toHaveBeenCalledWith(
      'acc-1',
      period.startDate,
    );
    expect(stats.startBalance).toBe('120000');
  });

  it('only loads the transactions of the period', async () => {
    await useCase.execute('acc-1', 'per-1');

    expect(transactions.findAllByAccountUnpaginated).toHaveBeenCalledWith(
      'acc-1',
      { startDate: period.startDate, endDate: period.endDate },
    );
  });

  it('sums real and planned income (transfer categories count as income)', async () => {
    const stats = await useCase.execute('acc-1', 'per-1');

    expect(stats.realIncome).toBe('260000');
    expect(stats.plannedIncome).toBe('250000');
  });

  it('sums real and planned expenses, ignoring uncategorized transactions', async () => {
    const stats = await useCase.execute('acc-1', 'per-1');

    expect(stats.realExpenses).toBe('-45000');
    expect(stats.plannedExpenses).toBe('40000');
  });

  it('computes the bank balance with reconciled transactions only', async () => {
    expect((await useCase.execute('acc-1', 'per-1')).realBankBalance).toBe(
      '340000',
    );
  });

  it('computes the upcoming balance with every non-pending transaction, categorized or not', async () => {
    expect((await useCase.execute('acc-1', 'per-1')).upcomingBalance).toBe(
      '345000',
    );
  });

  it('forecasts start + max(real, planned income) - max(|real|, |planned| expenses)', async () => {
    // 120000 + max(260000, 250000) - max(45000, 40000)
    expect((await useCase.execute('acc-1', 'per-1')).forecastBalance).toBe(
      '335000',
    );
  });

  it('uses the planned amounts when they exceed the real ones', async () => {
    transactions.findAllByAccountUnpaginated.mockResolvedValue([
      tx(100000, 'salaire'),
      tx(-10000, 'courses'),
    ]);

    // 120000 + 250000 - 40000
    expect((await useCase.execute('acc-1', 'per-1')).forecastBalance).toBe(
      '330000',
    );
  });

  it('returns only zeros on top of the start balance for an empty period', async () => {
    transactions.findAllByAccountUnpaginated.mockResolvedValue([]);
    budgets.findAllByPeriod.mockResolvedValue([]);

    expect(await useCase.execute('acc-1', 'per-1')).toEqual({
      startBalance: '120000',
      realIncome: '0',
      plannedIncome: '0',
      realExpenses: '0',
      plannedExpenses: '0',
      realBankBalance: '120000',
      upcomingBalance: '120000',
      forecastBalance: '120000',
    });
  });

  it('rejects a period of another account like an unknown one', async () => {
    await expect(useCase.execute('acc-1', 'per-1')).resolves.toBeDefined();
    accounts.findById.mockResolvedValue({ id: 'acc-other' });

    await expect(useCase.execute('acc-other', 'per-1')).rejects.toThrow(
      'Account or Period not found',
    );
  });

  it.each([
    ['account', 'accounts'],
    ['period', 'periods'],
  ])('rejects an unknown %s', async (_, repo) => {
    (repo === 'accounts' ? accounts : periods).findById.mockResolvedValue(null);

    await expect(useCase.execute('acc-1', 'per-1')).rejects.toThrow(
      'Account or Period not found',
    );
  });
});
