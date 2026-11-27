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

  describe("sens d'un virement (direction)", () => {
    it('CJ -2032,48 non parti : sortant, reste 2032,48, 0 %', async () => {
      budgets.findAllByPeriod.mockResolvedValue([budget('virement', -203248)]);
      transactions.findAllByAccountUnpaginated.mockResolvedValue([]);
      const { transfers } = await useCase.execute('acc-1', 'per-1');
      expect(transfers[0]).toMatchObject({
        direction: 'outgoing',
        real: '0',
        budget: '-203248',
        remaining: '203248',
        percentage: 0,
      });
    });

    it('CJ parti plus que prévu (-2100,00) : dépassement -67,52, comme une dépense', async () => {
      budgets.findAllByPeriod.mockResolvedValue([budget('virement', -203248)]);
      transactions.findAllByAccountUnpaginated.mockResolvedValue([
        tx(-210000, 'virement'),
      ]);
      const { transfers } = await useCase.execute('acc-1', 'per-1');
      expect(transfers[0]).toMatchObject({
        direction: 'outgoing',
        remaining: '-6752',
        percentage: 103,
      });
    });

    it('Salaire +2033,00 arrivé : entrant, reste 0', async () => {
      budgets.findAllByPeriod.mockResolvedValue([budget('virement', 203300)]);
      transactions.findAllByAccountUnpaginated.mockResolvedValue([
        tx(203300, 'virement'),
      ]);
      const { transfers } = await useCase.execute('acc-1', 'per-1');
      expect(transfers[0]).toMatchObject({
        direction: 'incoming',
        remaining: '0',
        percentage: 100,
      });
    });

    it('sans budget, réel négatif : sortant ; sans budget ni opération : entrant', async () => {
      budgets.findAllByPeriod.mockResolvedValue([]);
      transactions.findAllByAccountUnpaginated.mockResolvedValue([
        tx(-50000, 'virement'),
      ]);
      expect(
        (await useCase.execute('acc-1', 'per-1')).transfers[0].direction,
      ).toBe('outgoing');
      transactions.findAllByAccountUnpaginated.mockResolvedValue([]);
      expect(
        (await useCase.execute('acc-1', 'per-1')).transfers[0].direction,
      ).toBe('incoming');
    });

    it('seules les catégories de virement portent direction', async () => {
      const r = await useCase.execute('acc-1', 'per-1');
      expect(r.income[0].direction).toBeUndefined();
      expect(r.expenses[0].direction).toBeUndefined();
      expect(r.savings[0].direction).toBeUndefined();
    });
  });

  // Des budgets de dépenses sont enregistrés en négatif (même signe que le réel).
  it('un remboursement ne gonfle pas le reste au-delà de |budget| (dépense, épargne, virement sortant)', async () => {
    categories.findAllByAccount.mockResolvedValue([
      category('resto', CategoryType.EXPENSE),
      category('livret', CategoryType.SAVINGS),
      category('cj', CategoryType.TRANSFER),
    ]);
    budgets.findAllByPeriod.mockResolvedValue([
      budget('resto', 10000),
      budget('livret', 20000),
      budget('cj', -30000),
    ]);
    transactions.findAllByAccountUnpaginated.mockResolvedValue([
      tx(2000, 'resto'),
      tx(5000, 'livret'),
      tx(1000, 'cj'),
    ]);

    const { expenses, savings, transfers } = await useCase.execute(
      'acc-1',
      'per-1',
    );

    expect(expenses[0].remaining).toBe('10000');
    expect(savings[0].remaining).toBe('20000');
    expect(transfers[0].remaining).toBe('30000');
  });

  it('reports no overrun when an expense equals its negative budget', async () => {
    budgets.findAllByPeriod.mockResolvedValue([
      budget('courses', -45000),
      budget('loisirs', -1000),
    ]);

    const { expenses } = await useCase.execute('acc-1', 'per-1');

    expect(expenses[0]).toMatchObject({ remaining: '0', percentage: 100 });
    expect(expenses[1]).toMatchObject({ remaining: '-1000', percentage: 200 });
  });

  it('reports no overrun for an expense not yet spent on a negative budget', async () => {
    budgets.findAllByPeriod.mockResolvedValue([budget('courses', -15000)]);
    transactions.findAllByAccountUnpaginated.mockResolvedValue([]);

    const { expenses } = await useCase.execute('acc-1', 'per-1');

    expect(expenses[0]).toMatchObject({ remaining: '15000', percentage: 0 });
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

describe('GetBudgetBreakdownUseCase : fenêtre de période (factures réservées)', () => {
  const at = (date: string, amount: number, categoryId: string) =>
    Transaction.create({
      accountId: 'acc-1',
      categoryId,
      date: new Date(date),
      description: 'tx',
      amount: BigInt(amount),
      reconciled: false,
      pending: true,
    });

  const build = (p: Period) => {
    const list = [
      at('2026-11-10', -30000, 'courses'),
      at('2026-12-05', -12000, 'courses'),
      at('2026-12-06', 50000, 'salaire'),
    ];
    return new GetBudgetBreakdownUseCase(
      {
        findAllByAccount: jest
          .fn()
          .mockResolvedValue([
            category('salaire', CategoryType.INCOME),
            category('courses', CategoryType.EXPENSE),
          ]),
      } as unknown as CategoryRepository,
      {
        findAllByAccountUnpaginated: jest.fn(
          (_: string, o?: { startDate?: Date; endDate?: Date }) =>
            Promise.resolve(
              list.filter(
                (t) =>
                  (!o?.startDate || t.date >= o.startDate) &&
                  (!o?.endDate || t.date <= o.endDate),
              ),
            ),
        ),
      } as unknown as TransactionRepository,
      {
        findAllByPeriod: jest
          .fn()
          .mockResolvedValue([budget('courses', 40000)]),
      } as unknown as BudgetRepository,
      {
        findById: jest.fn().mockResolvedValue(p),
      } as unknown as PeriodRepository,
    );
  };

  const nov = (isActive: boolean) =>
    Period.create({
      id: 'per-1',
      accountId: 'acc-1',
      startDate: new Date('2026-11-01'),
      endDate: new Date('2026-11-30'),
      isActive,
    });

  it('active period: counts the expense and the income dated after the end (CA2)', async () => {
    const r = await build(nov(true)).execute('acc-1', 'per-1');

    expect(r.expenses[0]).toMatchObject({
      real: '-42000',
      remaining: '-2000',
    });
    expect(r.income[0].real).toBe('50000');
  });

  it('closed period: keeps its end date as upper bound', async () => {
    const r = await build(nov(false)).execute('acc-1', 'per-1');

    expect(r.expenses[0].real).toBe('-30000');
  });
});
