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

  it('loads from the start of the period without upper bound when active (reserved expenses after the end)', async () => {
    await useCase.execute('acc-1', 'per-1');

    expect(transactions.findAllByAccountUnpaginated).toHaveBeenCalledWith(
      'acc-1',
      { startDate: period.startDate, endDate: undefined },
    );
  });

  it('keeps the end date as upper bound for a closed period', async () => {
    periods.findById.mockResolvedValue(period.deactivate());

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

  it('forecasts start + max(real, planned income) - max(|real|, |planned| expenses) + uncategorized', async () => {
    // 120000 + max(260000, 250000) - max(45000, 40000) + (-5000 sans catégorie)
    expect((await useCase.execute('acc-1', 'per-1')).forecastBalance).toBe(
      '330000',
    );
  });

  // Sans catégorie (import pas encore trié, virement entre comptes) : compté au réel, sans budget.
  it('counts uncategorized transactions at their real amount in the forecast, pending included', async () => {
    transactions.findAllByAccountUnpaginated.mockResolvedValue([
      tx(-20000, null),
      tx(-50000, null, { pending: true }),
      tx(30000, null),
    ]);
    budgets.findAllByPeriod.mockResolvedValue([]);

    const stats = await useCase.execute('acc-1', 'per-1');

    // 120000 - 20000 - 50000 + 30000
    expect(stats.forecastBalance).toBe('80000');
    expect(stats.realIncome).toBe('0');
    expect(stats.realExpenses).toBe('0');
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

  it('sums planned amounts by absolute value whatever the sign each budget is stored with', async () => {
    const b = (categoryId: string, amount: number) =>
      BudgetInstance.create({
        periodId: 'per-1',
        categoryId,
        amountAllocated: BigInt(amount),
      });
    categories.findAllByAccount.mockResolvedValue([
      category('salaire', CategoryType.INCOME),
      category('courses', CategoryType.EXPENSE),
      category('loyer', CategoryType.EXPENSE),
      category('virement', CategoryType.TRANSFER),
    ]);
    budgets.findAllByPeriod.mockResolvedValue([
      b('salaire', 250000),
      b('virement', -10000),
      b('courses', -40000),
      b('loyer', 30000),
    ]);

    const stats = await useCase.execute('acc-1', 'per-1');

    expect(stats.plannedExpenses).toBe('70000');
    expect(stats.plannedIncome).toBe('260000');
  });

  it('adds uncategorized transactions (pending included) to max(real, planned) when planned exceeds real', async () => {
    transactions.findAllByAccountUnpaginated.mockResolvedValue([
      tx(100000, 'salaire'),
      tx(-10000, 'courses'),
      tx(-5000, null),
      tx(-3000, null, { pending: true }),
    ]);

    const stats = await useCase.execute('acc-1', 'per-1');

    // 120000 + max(100000, 250000) - max(10000, 40000) - 5000 - 3000
    expect(stats.forecastBalance).toBe('322000');
  });

  // Un virement entre deux comptes : une transaction sans catégorie sur chaque compte, de signe opposé.
  it.each([
    ['sender account (outgoing transfer)', -70000, '50000'],
    ['receiving account (incoming transfer)', 70000, '190000'],
  ])(
    'moves the forecast of the %s by the transfer amount',
    async (_, amount, expected) => {
      transactions.findAllByAccountUnpaginated.mockResolvedValue([
        tx(amount, null),
      ]);
      budgets.findAllByPeriod.mockResolvedValue([]);

      const stats = await useCase.execute('acc-1', 'per-1');

      // 120000 + amount
      expect(stats.forecastBalance).toBe(expected);
    },
  );

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
      cardTotal: '0',
      cardCount: 0,
      billsTotal: '0',
      budgetRemaining: '0',
      expectedIncome: '0',
    });
  });

  describe('composition du prévu', () => {
    // Base : départ 100000 (initial 100000, rien avant), D budget 30000, I budget 200000.
    const b = (categoryId: string, amount: number) =>
      BudgetInstance.create({
        periodId: 'per-1',
        categoryId,
        amountAllocated: BigInt(amount),
      });
    const base = () => [
      tx(200000, 'I', { reconciled: true }),
      tx(-10000, 'D', { reconciled: true }),
      tx(-5000, 'D'),
      tx(-8000, 'D', { pending: true }),
    ];
    const setup = (
      txs: Transaction[],
      budgetList = [b('D', 30000), b('I', 200000)],
      cats = [
        category('D', CategoryType.EXPENSE),
        category('I', CategoryType.INCOME),
        category('T', CategoryType.TRANSFER),
      ],
    ) => {
      transactions.sumAmountByAccountBeforeDate.mockResolvedValue(BigInt(0));
      transactions.findAllByAccountUnpaginated.mockResolvedValue(txs);
      budgets.findAllByPeriod.mockResolvedValue(budgetList);
      categories.findAllByAccount.mockResolvedValue(cats);
    };
    const sum = (s: Awaited<ReturnType<GetPeriodStatsUseCase['execute']>>) =>
      (
        BigInt(s.realBankBalance) +
        BigInt(s.cardTotal) +
        BigInt(s.billsTotal) +
        BigInt(s.budgetRemaining) +
        BigInt(s.expectedIncome)
      ).toString();

    const cases: [
      string,
      () => Transaction[],
      Parameters<typeof setup>[1],
      Parameters<typeof setup>[2],
      Record<string, string | number>,
      string,
    ][] = [
      [
        'nominal',
        base,
        undefined,
        undefined,
        {
          realBankBalance: '290000',
          cardTotal: '-5000',
          billsTotal: '-8000',
          budgetRemaining: '-7000',
          expectedIncome: '0',
        },
        '270000',
      ],
      [
        'revenu prévu 250000',
        base,
        [b('D', 30000), b('I', 250000)],
        undefined,
        { expectedIncome: '50000' },
        '320000',
      ],
      [
        'réel au-dessus du budget D',
        base,
        [b('D', 20000), b('I', 200000)],
        undefined,
        { budgetRemaining: '0' },
        '277000',
      ],
      [
        'revenu réel au-dessus du prévu',
        () => [tx(300000, 'I', { reconciled: true })],
        undefined,
        undefined,
        { expectedIncome: '0' },
        '370000',
      ],
      [
        'sans catégorie en CB',
        () => [...base(), tx(-3000, null)],
        undefined,
        undefined,
        { cardTotal: '-8000' },
        '267000',
      ],
      [
        'sans catégorie pending',
        () => [...base(), tx(-3000, null, { pending: true })],
        undefined,
        undefined,
        { billsTotal: '-11000' },
        '267000',
      ],
      [
        'pending rapprochée',
        () => [
          tx(200000, 'I', { reconciled: true }),
          tx(-10000, 'D', { reconciled: true }),
          tx(-5000, 'D'),
          tx(-8000, 'D', { pending: true, reconciled: true }),
        ],
        undefined,
        undefined,
        { realBankBalance: '282000', billsTotal: '0', cardTotal: '-5000' },
        '270000',
      ],
      [
        'remboursement CB +4000',
        () => [...base(), tx(4000, 'D')],
        undefined,
        undefined,
        { cardTotal: '-1000', budgetRemaining: '-11000' },
        '270000',
      ],
      [
        'remboursement CB +9000 (CB positive)',
        () => [...base(), tx(9000, 'D')],
        undefined,
        undefined,
        { cardTotal: '4000' },
        '270000',
      ],
      [
        'dépenses nettes positives',
        () => [tx(5000, 'D', { reconciled: true })],
        [b('D', 3000)],
        undefined,
        { realBankBalance: '105000', budgetRemaining: '-10000' },
        '95000',
      ],
      [
        'prévu négatif, aucune transaction',
        () => [],
        [b('D', 50000)],
        undefined,
        { budgetRemaining: '-50000', cardTotal: '0', billsTotal: '0' },
        '50000',
      ],
      [
        'période vide sans budget',
        () => [],
        [],
        undefined,
        { budgetRemaining: '0', expectedIncome: '0', cardTotal: '0' },
        '100000',
      ],
      [
        'virement catégorisé en revenus',
        () => [tx(10000, 'T', { reconciled: true })],
        [],
        undefined,
        { expectedIncome: '0' },
        '110000',
      ],
      [
        'revenu net négatif',
        () => [tx(-2000, 'I', { reconciled: true })],
        [],
        undefined,
        { expectedIncome: '2000' },
        '100000',
      ],
      [
        'budget D stocké en négatif',
        base,
        [b('D', -30000), b('I', 200000)],
        undefined,
        { budgetRemaining: '-7000' },
        '270000',
      ],
    ];

    it.each(cases)(
      '%s',
      async (_n, txs, budgetList, cats, expected, forecast) => {
        setup(txs(), budgetList, cats);

        const stats = await useCase.execute('acc-1', 'per-1');

        expect(stats).toMatchObject(expected);
        expect(stats.forecastBalance).toBe(forecast);
        // Invariant de la règle critique : la somme des lignes = le prévu, au centime
        expect(sum(stats)).toBe(stats.forecastBalance);
      },
    );

    it('cardCount compte les transactions non rapprochées et non pending', async () => {
      setup([...base(), tx(-3000, null)]);

      expect((await useCase.execute('acc-1', 'per-1')).cardCount).toBe(2);
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
