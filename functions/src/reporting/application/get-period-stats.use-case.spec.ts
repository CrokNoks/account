import { Logger } from '@nestjs/common';
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

const category = (id: string, type: CategoryType, isPeriodTrigger = false) =>
  new Category({
    id,
    name: id,
    color: '#000000',
    type,
    isPeriodTrigger,
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

/** Trois départs identiques par défaut ; `all`, `reconciled`, `nonPending` se surchargent. */
const starts = (
  all: number,
  o: { reconciled?: number; nonPending?: number } = {},
) => ({
  all: BigInt(all),
  reconciled: BigInt(o.reconciled ?? all),
  nonPending: BigInt(o.nonPending ?? all),
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
    sumAmountsBeforeDateByBalance: jest.Mock;
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
      sumAmountsBeforeDateByBalance: jest.fn().mockResolvedValue(starts(20000)),
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

    expect(transactions.sumAmountsBeforeDateByBalance).toHaveBeenCalledWith(
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

    // Un virement à budget négatif est sortant : rangé avec les dépenses (sens du virement, docs/reporting.md).
    expect(stats.plannedExpenses).toBe('80000');
    expect(stats.plannedIncome).toBe('250000');
    expect(stats.plannedExpensesExTransfers).toBe('70000');
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
      plannedExpensesExTransfers: '0',
      realBankBalance: '120000',
      upcomingBalance: '120000',
      forecastBalance: '120000',
      cardTotal: '0',
      cardCount: 0,
      billsTotal: '0',
      reportsTotal: '0',
      budgetRemaining: '0',
      expectedIncome: '0',
      budgetRemainingDetail: [],
    });
  });

  describe("sens d'un virement (budget négatif = sortant)", () => {
    const b = (categoryId: string, amount: number) =>
      BudgetInstance.create({
        periodId: 'per-1',
        categoryId,
        amountAllocated: BigInt(amount),
      });
    const setup = (txs: Transaction[], budgetList: BudgetInstance[]) => {
      transactions.sumAmountsBeforeDateByBalance.mockResolvedValue(starts(0));
      transactions.findAllByAccountUnpaginated.mockResolvedValue(txs);
      budgets.findAllByPeriod.mockResolvedValue(budgetList);
      categories.findAllByAccount.mockResolvedValue([
        category('D', CategoryType.EXPENSE),
        category('CJ', CategoryType.TRANSFER),
        category('SAL', CategoryType.TRANSFER),
      ]);
    };

    it('CJ -2032,48 non parti : le prévu baisse, Revenus prévus ne le compte plus, Total budgété le compte', async () => {
      setup([], [b('CJ', -203248), b('SAL', 203300), b('D', 50000)]);
      const s = await useCase.execute('acc-1', 'per-1');
      // départ 100000 + (-2032,48 + 2033,00 - 500,00)
      expect(s.forecastBalance).toBe('50052');
      expect(s.plannedIncome).toBe('203300');
      expect(s.plannedExpenses).toBe('253248');
      expect(s.plannedExpensesExTransfers).toBe('50000');
      expect(s.budgetRemaining).toBe('-253248');
      expect(s.expectedIncome).toBe('203300');
    });

    it('la composition tient au centime : CJ parti en partie, Salaire arrivé', async () => {
      setup(
        [
          tx(-100000, 'CJ', { reconciled: true }),
          tx(203300, 'SAL', { reconciled: true }),
        ],
        [b('CJ', -203248), b('SAL', 203300)],
      );
      const s = await useCase.execute('acc-1', 'per-1');
      expect(s.forecastBalance).toBe('100052');
      const sum =
        BigInt(s.realBankBalance) +
        BigInt(s.cardTotal) +
        BigInt(s.billsTotal) +
        BigInt(s.reportsTotal) +
        BigInt(s.budgetRemaining) +
        BigInt(s.expectedIncome);
      expect(sum.toString()).toBe(s.forecastBalance);
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
      transactions.sumAmountsBeforeDateByBalance.mockResolvedValue(starts(0));
      transactions.findAllByAccountUnpaginated.mockResolvedValue(txs);
      budgets.findAllByPeriod.mockResolvedValue(budgetList);
      categories.findAllByAccount.mockResolvedValue(cats);
    };
    const sum = (s: Awaited<ReturnType<GetPeriodStatsUseCase['execute']>>) =>
      (
        BigInt(s.realBankBalance) +
        BigInt(s.cardTotal) +
        BigInt(s.billsTotal) +
        BigInt(s.reportsTotal) +
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
        { realBankBalance: '105000', budgetRemaining: '-3000' },
        '102000',
      ],
      [
        'remboursement net sans budget',
        () => [tx(10000, 'D', { reconciled: true })],
        [],
        undefined,
        { realBankBalance: '110000', budgetRemaining: '0' },
        '110000',
      ],
      [
        'remboursement net avec budget',
        () => [tx(10000, 'D', { reconciled: true })],
        [b('D', 50000)],
        undefined,
        { realBankBalance: '110000', budgetRemaining: '-50000' },
        '60000',
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
        // Miroir de l'option B : sans budget le négatif se déduit (retenu = réel), rien n'est attendu.
        { expectedIncome: '0' },
        '98000',
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

  describe('départs séparés et revenu tardif (CA1-CA4, CA7)', () => {
    const b = (categoryId: string, amount: number) =>
      BudgetInstance.create({
        periodId: 'per-1',
        categoryId,
        amountAllocated: BigInt(amount),
      });
    const at = (
      date: string,
      amount: number,
      categoryId: string | null,
      flags: {
        reconciled?: boolean;
        pending?: boolean;
        metadata?: Record<string, any>;
      } = {},
    ) =>
      Transaction.create({
        accountId: 'acc-1',
        categoryId,
        date: new Date(`${date}T00:00:00.000Z`),
        description: 'tx',
        amount: BigInt(amount),
        reconciled: flags.reconciled ?? false,
        pending: flags.pending ?? false,
        metadata: flags.metadata,
      });
    const sixLines = (
      s: Awaited<ReturnType<GetPeriodStatsUseCase['execute']>>,
    ) =>
      (
        BigInt(s.realBankBalance) +
        BigInt(s.cardTotal) +
        BigInt(s.billsTotal) +
        BigInt(s.reportsTotal) +
        BigInt(s.budgetRemaining) +
        BigInt(s.expectedIncome)
      ).toString();

    // Exemple A (centimes) : compte initial 0, P2 = mars active (fin 31/03).
    // Avant : salaire +2000 pointé, loyer -800 pointé, CB -60, facture -90 pending.
    const exampleA = () => {
      accounts.findById.mockResolvedValue(
        new Account({
          id: 'acc-1',
          name: 'Courant',
          ownerId: 'u-1',
          initialBalance: BigInt(0),
        }),
      );
      // tout 1050 ; pointées 1200 ; non pending 1200 - 60 = 1140
      transactions.sumAmountsBeforeDateByBalance.mockResolvedValue({
        all: 105000n,
        reconciled: 120000n,
        nonPending: 114000n,
      });
      transactions.findAllByAccountUnpaginated.mockResolvedValue([
        at('2026-03-05', 200000, 'salaire', { reconciled: true }),
        at('2026-03-10', -30000, 'courses', { reconciled: true }),
        at('2026-03-12', -4000, 'resto'),
        at('2026-03-20', -80000, 'loyer', { pending: true }),
      ]);
      budgets.findAllByPeriod.mockResolvedValue([
        b('salaire', 200000),
        b('courses', 40000),
        b('resto', 10000),
        b('loyer', 80000),
      ]);
      categories.findAllByAccount.mockResolvedValue([
        category('salaire', CategoryType.INCOME),
        category('courses', CategoryType.EXPENSE),
        category('resto', CategoryType.EXPENSE),
        category('loyer', CategoryType.EXPENSE),
        category('prime', CategoryType.INCOME),
      ]);
    };

    it('A : En banque 2 900, À venir 2 800, prévu 1 750, reports -150, composition = prévu', async () => {
      exampleA();

      const stats = await useCase.execute('acc-1', 'per-1');

      expect(stats).toMatchObject({
        startBalance: '105000',
        realBankBalance: '290000',
        upcomingBalance: '280000',
        forecastBalance: '175000',
        cardTotal: '-4000',
        billsTotal: '-80000',
        reportsTotal: '-15000',
        budgetRemaining: '-16000',
        expectedIncome: '0',
      });
      expect(sixLines(stats)).toBe(stats.forecastBalance);
    });

    it('A2 : une CB ancienne non pointée reste dans À venir mais plus dans En banque', async () => {
      exampleA();
      transactions.sumAmountsBeforeDateByBalance.mockResolvedValue({
        all: 94000n,
        reconciled: 100000n,
        nonPending: 94000n,
      });
      transactions.findAllByAccountUnpaginated.mockResolvedValue([]);
      budgets.findAllByPeriod.mockResolvedValue([]);

      const stats = await useCase.execute('acc-1', 'per-1');

      expect(stats.realBankBalance).toBe('100000');
      expect(stats.upcomingBalance).toBe('94000');
      expect(stats.forecastBalance).toBe('94000');
      expect(stats.reportsTotal).toBe('-6000');
    });

    it('A3 : une facture pending ancienne n’est ni en banque ni à venir, mais dans le prévu', async () => {
      exampleA();
      transactions.sumAmountsBeforeDateByBalance.mockResolvedValue({
        all: 91000n,
        reconciled: 100000n,
        nonPending: 100000n,
      });
      transactions.findAllByAccountUnpaginated.mockResolvedValue([]);
      budgets.findAllByPeriod.mockResolvedValue([]);

      const stats = await useCase.execute('acc-1', 'per-1');

      expect(stats.realBankBalance).toBe('100000');
      expect(stats.upcomingBalance).toBe('100000');
      expect(stats.forecastBalance).toBe('91000');
      expect(stats.reportsTotal).toBe('-9000');
    });

    it('F : prime +300 pointée datée après la fin d’une période active : dans la fenêtre, En banque 3 200, À venir 3 100, prévu 2 050 (CA2, CA4)', async () => {
      exampleA();
      const txs =
        (await transactions.findAllByAccountUnpaginated()) as Transaction[];
      transactions.findAllByAccountUnpaginated.mockResolvedValue([
        ...txs,
        at('2026-04-02', 30000, 'prime', { reconciled: true }),
      ]);

      const stats = await useCase.execute('acc-1', 'per-1');

      expect(stats).toMatchObject({
        realBankBalance: '320000',
        upcomingBalance: '310000',
        forecastBalance: '205000',
      });
      expect(stats).not.toHaveProperty('arrivedAfterEnd');
      expect(sixLines(stats)).toBe(stats.forecastBalance);
    });

    it('F3 : un revenu non pointé après la fin d’une période active compte (CA2) : prévu et À venir, pas En banque', async () => {
      exampleA();
      const txs =
        (await transactions.findAllByAccountUnpaginated()) as Transaction[];
      transactions.findAllByAccountUnpaginated.mockResolvedValue([
        ...txs,
        at('2026-04-02', 30000, 'prime', { pending: true }),
        at('2026-04-03', 12000, 'prime'),
      ]);

      const stats = await useCase.execute('acc-1', 'per-1');

      expect(stats).toMatchObject({
        realBankBalance: '290000',
        upcomingBalance: '292000',
        forecastBalance: '217000',
      });
      expect(sixLines(stats)).toBe(stats.forecastBalance);
    });

    it('F5 : la prochaine paie (pending, recurringId, après la fin) est exclue ; pointée ou sans recurringId elle compte (CA3)', async () => {
      exampleA();
      categories.findAllByAccount.mockResolvedValue([
        category('salaire', CategoryType.INCOME, true),
        category('courses', CategoryType.EXPENSE),
        category('resto', CategoryType.EXPENSE),
        category('loyer', CategoryType.EXPENSE),
      ]);
      const txs =
        (await transactions.findAllByAccountUnpaginated()) as Transaction[];
      const recurring = { metadata: { recurringId: 'rec-1' } };
      transactions.findAllByAccountUnpaginated.mockResolvedValue([
        ...txs,
        at('2026-04-01', 200000, 'salaire', { pending: true, ...recurring }),
      ]);
      const excluded = await useCase.execute('acc-1', 'per-1');
      expect(excluded.forecastBalance).toBe('175000');
      expect(excluded.upcomingBalance).toBe('280000');

      transactions.findAllByAccountUnpaginated.mockResolvedValue([
        ...txs,
        at('2026-04-01', 200000, 'salaire', { pending: true }),
      ]);
      const counted = await useCase.execute('acc-1', 'per-1');
      // salaire budgété 2 000 déjà reçu 2 000 : le réel passe à 4 000, prévu + 2 000
      expect(counted.forecastBalance).toBe('375000');
      expect(sixLines(counted)).toBe(counted.forecastBalance);
    });

    it('CA4 chiffré : salaire pointé +2 000 daté après la fin : composition = prévu = 3 450', async () => {
      accounts.findById.mockResolvedValue(
        new Account({
          id: 'acc-1',
          name: 'Courant',
          ownerId: 'u-1',
          initialBalance: BigInt(100000),
        }),
      );
      // avant le début : revenu pointé +200, facture pending -50
      transactions.sumAmountsBeforeDateByBalance.mockResolvedValue({
        all: 15000n,
        reconciled: 20000n,
        nonPending: 20000n,
      });
      transactions.findAllByAccountUnpaginated.mockResolvedValue([
        at('2026-03-10', -3000, 'courses'),
        at('2026-03-12', -8000, 'courses', { pending: true }),
        at('2026-03-15', -1000, 'courses', { reconciled: true }),
        at('2026-04-03', 200000, 'salaire', { reconciled: true }),
      ]);
      budgets.findAllByPeriod.mockResolvedValue([
        b('courses', 20000),
        b('salaire', 250000),
      ]);
      categories.findAllByAccount.mockResolvedValue([
        category('salaire', CategoryType.INCOME),
        category('courses', CategoryType.EXPENSE),
      ]);

      const stats = await useCase.execute('acc-1', 'per-1');

      expect(stats).toMatchObject({
        realBankBalance: '319000',
        cardTotal: '-3000',
        billsTotal: '-8000',
        reportsTotal: '-5000',
        budgetRemaining: '-8000',
        expectedIncome: '50000',
        forecastBalance: '345000',
      });
      expect(stats).not.toHaveProperty('arrivedAfterEnd');
      expect(sixLines(stats)).toBe('345000');
    });

    it('F4 : une dépense pointée après la fin est déjà dans la fenêtre (pas de tardif)', async () => {
      exampleA();
      const txs =
        (await transactions.findAllByAccountUnpaginated()) as Transaction[];
      transactions.findAllByAccountUnpaginated.mockResolvedValue([
        ...txs,
        at('2026-04-02', -5000, null, { reconciled: true }),
      ]);

      const stats = await useCase.execute('acc-1', 'per-1');

      expect(stats).not.toHaveProperty('arrivedAfterEnd');
      expect(stats.realBankBalance).toBe('285000');
      expect(stats.forecastBalance).toBe('170000');
      expect(sixLines(stats)).toBe(stats.forecastBalance);
    });

    it('F2 : période fermée, la prime pointée datée après sa fin n’est pas chargée ni comptée', async () => {
      exampleA();
      periods.findById.mockResolvedValue(period.deactivate());
      const txs =
        (await transactions.findAllByAccountUnpaginated()) as Transaction[];
      transactions.findAllByAccountUnpaginated.mockResolvedValue([
        ...txs,
        at('2026-04-02', 30000, 'prime', { reconciled: true }),
      ]);

      const stats = await useCase.execute('acc-1', 'per-1');

      expect(stats).not.toHaveProperty('arrivedAfterEnd');
      expect(stats.realBankBalance).toBe('290000');
      expect(stats.forecastBalance).toBe('175000');
    });

    it('G : salaire pointé -50 / budget 2 000 : revenus attendus 2 000, égalité tenue', async () => {
      exampleA();
      transactions.findAllByAccountUnpaginated.mockResolvedValue([
        at('2026-03-05', -5000, 'salaire', { reconciled: true }),
      ]);
      budgets.findAllByPeriod.mockResolvedValue([b('salaire', 200000)]);

      const stats = await useCase.execute('acc-1', 'per-1');

      expect(stats.expectedIncome).toBe('200000');
      // 1050 + (2000 - 50)
      expect(stats.forecastBalance).toBe('300000');
      expect(sixLines(stats)).toBe(stats.forecastBalance);
    });

    it('B : un dépassement n’est plus masqué par un budget non consommé (stats)', async () => {
      exampleA();
      transactions.sumAmountsBeforeDateByBalance.mockResolvedValue(starts(0));
      transactions.findAllByAccountUnpaginated.mockResolvedValue([
        at('2026-03-05', -50000, 'courses', { reconciled: true }),
      ]);
      budgets.findAllByPeriod.mockResolvedValue([
        b('courses', 30000),
        b('loyer', 80000),
      ]);

      const stats = await useCase.execute('acc-1', 'per-1');

      expect(stats.forecastBalance).toBe('-130000');
      expect(sixLines(stats)).toBe(stats.forecastBalance);
    });

    it('R1 : une panne de la fonction de départs fait échouer les stats (jamais un départ à 0)', async () => {
      transactions.sumAmountsBeforeDateByBalance.mockRejectedValue(
        new Error('rpc down'),
      );

      await expect(useCase.execute('acc-1', 'per-1')).rejects.toThrow(
        'rpc down',
      );
    });
  });

  describe('budgetRemainingDetail', () => {
    const named = (id: string, name: string, type: CategoryType) =>
      new Category({
        id,
        name,
        color: '#000000',
        type,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    const budget = (categoryId: string, amount: number) =>
      BudgetInstance.create({
        periodId: 'per-1',
        categoryId,
        amountAllocated: BigInt(amount),
      });

    const setup = (
      cats: Category[],
      budgetList: BudgetInstance[],
      txs: Transaction[],
    ) => {
      categories.findAllByAccount.mockResolvedValue(cats);
      budgets.findAllByPeriod.mockResolvedValue(budgetList);
      transactions.findAllByAccountUnpaginated.mockResolvedValue(txs);
    };

    const expectSum = (stats: {
      budgetRemaining: string;
      budgetRemainingDetail: Array<{ remaining: string }>;
    }) =>
      expect(
        stats.budgetRemainingDetail.reduce(
          (s, l) => s + BigInt(l.remaining),
          BigInt(0),
        ),
      ).toBe(-BigInt(stats.budgetRemaining));

    it('jeu mixte : trié par reste décroissant, Σ = -budgetRemaining', async () => {
      setup(
        [
          named('c', 'Courses', CategoryType.EXPENSE),
          named('r', 'Resto', CategoryType.EXPENSE),
          named('o', 'Dépassée', CategoryType.EXPENSE),
          named('e', 'Épargne', CategoryType.SAVINGS),
          named('v', 'Virement sortant', CategoryType.TRANSFER),
          named('vi', 'Virement entrant', CategoryType.TRANSFER),
          named('s', 'Salaire', CategoryType.INCOME),
        ],
        [
          budget('c', 40000),
          budget('r', 10000),
          budget('o', 5000),
          budget('e', 5001),
          budget('v', -20000),
          budget('vi', 20000),
          budget('s', 250000),
        ],
        [
          tx(-15000, 'c'),
          tx(2000, 'r'),
          tx(-9000, 'o'),
          tx(-5001, 'v'),
          tx(100, 'vi'),
        ],
      );

      const stats = await useCase.execute('acc-1', 'per-1');

      expect(stats.budgetRemainingDetail).toEqual([
        { categoryId: 'c', name: 'Courses', remaining: '25000' },
        { categoryId: 'v', name: 'Virement sortant', remaining: '14999' },
        { categoryId: 'r', name: 'Resto', remaining: '10000' },
        { categoryId: 'e', name: 'Épargne', remaining: '5001' },
      ]);
      expectSum(stats);
    });

    it('même reste : ordre par nom, insensible à la casse', async () => {
      setup(
        [
          named('1', 'zèbre', CategoryType.EXPENSE),
          named('2', 'Abeille', CategoryType.EXPENSE),
          named('3', 'chat', CategoryType.EXPENSE),
        ],
        [budget('1', 1000), budget('2', 1000), budget('3', 1000)],
        [],
      );

      const stats = await useCase.execute('acc-1', 'per-1');

      expect(stats.budgetRemainingDetail.map((l) => l.name)).toEqual([
        'Abeille',
        'chat',
        'zèbre',
      ]);
      expectSum(stats);
    });

    it('même reste et même nom : ordre par categoryId, stable', async () => {
      setup(
        [
          named('b', 'Doublon', CategoryType.EXPENSE),
          named('a', 'Doublon', CategoryType.EXPENSE),
        ],
        [budget('b', 1000), budget('a', 1000)],
        [],
      );

      const stats = await useCase.execute('acc-1', 'per-1');

      expect(stats.budgetRemainingDetail.map((l) => l.categoryId)).toEqual([
        'a',
        'b',
      ]);
    });

    it('aucun budget restant : liste vide et budgetRemaining 0', async () => {
      setup(
        [named('c', 'Courses', CategoryType.EXPENSE)],
        [budget('c', 1000)],
        [tx(-1000, 'c')],
      );

      const stats = await useCase.execute('acc-1', 'per-1');

      expect(stats.budgetRemaining).toBe('0');
      expect(stats.budgetRemainingDetail).toEqual([]);
    });

    it("n'émet aucun warn quand l'invariant tient", async () => {
      const warn = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);
      setup(
        [named('c', 'Courses', CategoryType.EXPENSE)],
        [budget('c', 1000)],
        [],
      );

      await useCase.execute('acc-1', 'per-1');

      expect(warn).not.toHaveBeenCalled();
      warn.mockRestore();
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
