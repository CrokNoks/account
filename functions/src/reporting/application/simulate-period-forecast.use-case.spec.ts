import { SimulatePeriodForecastUseCase } from './simulate-period-forecast.use-case';
import { GetPeriodStatsUseCase } from './get-period-stats.use-case';
import { AccountRepository } from '../../accounts/domain/account.repository.interface';
import { PeriodRepository } from '../../periods/domain/period.repository.interface';
import { TransactionRepository } from '../../transactions/domain/transaction.repository.interface';
import { BudgetRepository } from '../../budgets/domain/budget.repository.interface';
import { CategoryRepository } from '../../categories/domain/category.repository.interface';
import { AccountReferencesService } from '../../shared/application/account-references.service';
import { Account } from '../../accounts/domain/account.entity';
import { Period } from '../../periods/domain/period.entity';
import {
  Category,
  CategoryType,
} from '../../categories/domain/category.entity';
import { BudgetInstance } from '../../budgets/domain/budget-instance.entity';
import { Transaction } from '../../transactions/domain/transaction.entity';
import {
  DomainValidationError,
  NotFoundError,
} from '../../shared/domain/errors';

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
  flags: { pending?: boolean } = {},
) =>
  Transaction.create({
    accountId: 'acc-1',
    categoryId,
    date: new Date('2026-03-10'),
    description: 'tx',
    amount: BigInt(amount),
    reconciled: false,
    pending: flags.pending ?? false,
  });

const saved = (categoryId: string, amount: number) =>
  BudgetInstance.create({
    periodId: 'per-1',
    categoryId,
    amountAllocated: BigInt(amount),
  });

const body = (categoryId: string, amount: number) => ({
  categoryId,
  amount: BigInt(amount),
});

describe('SimulatePeriodForecastUseCase', () => {
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
  let budgets: {
    findAllByPeriod: jest.Mock;
    replaceForPeriod: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
  };
  let categories: { findAllByAccount: jest.Mock };
  let refs: { ensureCategories: jest.Mock };
  let useCase: SimulatePeriodForecastUseCase;
  let stats: GetPeriodStatsUseCase;

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
      sumAmountByAccountBeforeDate: jest.fn().mockResolvedValue(BigInt(0)),
      findAllByAccountUnpaginated: jest
        .fn()
        .mockResolvedValue([
          tx(200000, 'I'),
          tx(-50000, 'A'),
          tx(-100000, 'B', { pending: true }),
          tx(-2000, null, { pending: true }),
          tx(-7000, 'Z'),
        ]),
    };
    budgets = {
      findAllByPeriod: jest
        .fn()
        .mockResolvedValue([saved('A', 80000), saved('B', 30000)]),
      replaceForPeriod: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    categories = {
      findAllByAccount: jest
        .fn()
        .mockResolvedValue([
          category('A', CategoryType.EXPENSE),
          category('B', CategoryType.EXPENSE),
          category('Z', CategoryType.EXPENSE),
          category('I', CategoryType.INCOME),
          category('T', CategoryType.TRANSFER),
          category('S', CategoryType.SAVINGS),
        ]),
    };
    refs = { ensureCategories: jest.fn().mockResolvedValue(undefined) };
    useCase = new SimulatePeriodForecastUseCase(
      accounts as unknown as AccountRepository,
      periods as unknown as PeriodRepository,
      transactions as unknown as TransactionRepository,
      budgets as unknown as BudgetRepository,
      categories as unknown as CategoryRepository,
      refs as unknown as AccountReferencesService,
    );
    stats = new GetPeriodStatsUseCase(
      accounts as unknown as AccountRepository,
      periods as unknown as PeriodRepository,
      transactions as unknown as TransactionRepository,
      budgets as unknown as BudgetRepository,
      categories as unknown as CategoryRepository,
    );
  });

  const run = (list: ReturnType<typeof body>[]) =>
    useCase.execute({
      accountId: 'acc-1',
      periodId: 'per-1',
      budgets: list,
    });

  // Règle critique : la simulation d'une liste = les stats une fois cette liste enregistrée.
  describe('parity: simulation = stats after saving the same budgets', () => {
    const cases: [string, Array<[string, number]>][] = [
      ['budget under the real', [['A', 20000]]],
      [
        'budget above the real',
        [
          ['A', 400000],
          ['B', 5000],
        ],
      ],
      [
        'negative budget',
        [
          ['A', -40000],
          ['I', -300000],
        ],
      ],
      [
        'negative budget left as read next to a positive one',
        [
          ['A', -40000],
          ['B', 30000],
        ],
      ],
      [
        'negative budget re-entered as positive',
        [
          ['A', 40000],
          ['B', 30000],
        ],
      ],
      [
        'budget at 0',
        [
          ['A', 0],
          ['B', 0],
        ],
      ],
      ['category without budget', [['B', 30000]]],
      [
        'income and transfer budgets',
        [
          ['I', 150000],
          ['T', 20000],
          ['S', 40000],
        ],
      ],
      ['empty list', []],
    ];

    it.each(cases)('%s', async (_name, list) => {
      const simulated = await run(list.map(([c, a]) => body(c, a)));

      // Enregistrement : le cas d'usage d'écriture écarte les 0 ; les stats relisent le résultat.
      budgets.findAllByPeriod.mockResolvedValue(
        list.filter(([, a]) => a !== 0).map(([c, a]) => saved(c, a)),
      );
      const after = await stats.execute('acc-1', 'per-1');

      expect(simulated.forecastBalance).toBe(after.forecastBalance);
      expect(simulated.plannedIncome).toBe(after.plannedIncome);
      expect(simulated.plannedExpenses).toBe(after.plannedExpenses);
      expect(simulated.realIncome).toBe(after.realIncome);
      expect(simulated.realExpenses).toBe(after.realExpenses);
    });
  });

  it('with the saved budgets as body: same as the stats, delta 0', async () => {
    const result = await run([body('A', 80000), body('B', 30000)]);
    const s = await stats.execute('acc-1', 'per-1');

    expect(result.forecastBalance).toBe(s.forecastBalance);
    expect(result.savedForecastBalance).toBe(s.forecastBalance);
    expect(result.delta).toBe('0');
    expect(result.incomeEffect).toBe('0');
    expect(result.expensesEffect).toBe('0');
  });

  describe('effect of the change', () => {
    // Départ 100000 ; réel dépenses : A -50000, B -100000, Z -7000 = 157000.
    it('lowering A under the real: planned changes, no effect (CA3)', async () => {
      // enregistré : A 80000 + B 30000 = 110000 < 157000 ; simulé : 20000 + 30000 = 50000
      const r = await run([body('A', 20000), body('B', 30000)]);
      expect(r.plannedExpenses).toBe('50000');
      expect(r.expensesEffect).toBe('0');
      expect(r.incomeEffect).toBe('0');
      expect(r.delta).toBe('0');
    });

    it('a high budget on B keeps an effect', async () => {
      budgets.findAllByPeriod.mockResolvedValue([
        saved('A', 80000),
        saved('B', 100000),
      ]);
      // enregistré 180000 ; simulé 120000 : le réel (157000) plafonne
      const r = await run([body('A', 20000), body('B', 100000)]);
      expect(r.expensesEffect).toBe('23000');
      expect(r.delta).toBe('23000');
    });

    it('crossing the real gives a partial effect', async () => {
      const r = await run([body('A', 130000), body('B', 30000)]);
      // simulé 160000 vs réel 157000 : -3000 par rapport à 157000
      expect(r.expensesEffect).toBe('-3000');
    });

    it('income side', async () => {
      const r = await run([
        body('A', 80000),
        body('B', 30000),
        body('I', 250000),
      ]);
      // réel revenus 200000, prévu 250000 : +50000
      expect(r.incomeEffect).toBe('50000');
      expect(r.expensesEffect).toBe('0');
      expect(r.delta).toBe('50000');
    });

    it('delta = incomeEffect + expensesEffect', async () => {
      const r = await run([body('A', 400000), body('I', 250000)]);
      expect(BigInt(r.delta)).toBe(
        BigInt(r.incomeEffect) + BigInt(r.expensesEffect),
      );
      expect(BigInt(r.forecastBalance) - BigInt(r.savedForecastBalance)).toBe(
        BigInt(r.delta),
      );
    });
  });

  it('never writes', async () => {
    await run([body('A', 1)]);

    expect(budgets.replaceForPeriod).not.toHaveBeenCalled();
    expect(budgets.save).not.toHaveBeenCalled();
    expect(budgets.delete).not.toHaveBeenCalled();
  });

  it('404 for an account or a period that does not match', async () => {
    periods.findById.mockResolvedValue(
      Period.create({
        id: 'per-1',
        accountId: 'acc-other',
        startDate: new Date('2026-03-01'),
        endDate: new Date('2026-03-31'),
      }),
    );
    await expect(run([])).rejects.toBeInstanceOf(NotFoundError);

    periods.findById.mockResolvedValue(null);
    await expect(run([])).rejects.toBeInstanceOf(NotFoundError);

    periods.findById.mockResolvedValue(period);
    accounts.findById.mockResolvedValue(null);
    await expect(run([])).rejects.toBeInstanceOf(NotFoundError);
  });

  it('refuses a category of another account', async () => {
    refs.ensureCategories.mockRejectedValue(
      new DomainValidationError('Category does not belong to this account'),
    );
    await expect(run([body('foreign', 100)])).rejects.toBeInstanceOf(
      DomainValidationError,
    );
    expect(refs.ensureCategories).toHaveBeenCalledWith('acc-1', ['foreign']);
  });

  it('refuses a duplicated category', async () => {
    await expect(run([body('A', 100), body('A', 200)])).rejects.toBeInstanceOf(
      DomainValidationError,
    );
  });
});

describe('SimulatePeriodForecastUseCase : fenêtre de période (factures réservées)', () => {
  it('same forecast, real expenses and real income as the stats with an expense dated after the end', async () => {
    const mk = (date: string, amount: number, categoryId: string) =>
      Transaction.create({
        accountId: 'acc-1',
        categoryId,
        date: new Date(date),
        description: 'tx',
        amount: BigInt(amount),
        reconciled: false,
        pending: true,
      });
    const list = [
      mk('2026-03-10', -50000, 'A'),
      mk('2026-04-05', -12000, 'A'),
      mk('2026-04-06', 90000, 'I'),
    ];
    const accounts = {
      findById: jest.fn().mockResolvedValue(
        new Account({
          id: 'acc-1',
          name: 'Courant',
          ownerId: 'u-1',
          initialBalance: BigInt(100000),
        }),
      ),
    };
    const periods = {
      findById: jest.fn().mockResolvedValue(
        Period.create({
          id: 'per-1',
          accountId: 'acc-1',
          startDate: new Date('2026-03-01'),
          endDate: new Date('2026-03-31'),
        }),
      ),
    };
    const transactions = {
      sumAmountByAccountBeforeDate: jest.fn().mockResolvedValue(BigInt(0)),
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
    };
    const saved1 = [saved('A', 80000)];
    const budgets = {
      findAllByPeriod: jest.fn().mockResolvedValue(saved1),
    };
    const categories = {
      findAllByAccount: jest
        .fn()
        .mockResolvedValue([
          category('A', CategoryType.EXPENSE),
          category('I', CategoryType.INCOME),
        ]),
    };
    const sim = new SimulatePeriodForecastUseCase(
      accounts as unknown as AccountRepository,
      periods as unknown as PeriodRepository,
      transactions as unknown as TransactionRepository,
      budgets as unknown as BudgetRepository,
      categories as unknown as CategoryRepository,
      {
        ensureCategories: jest.fn().mockResolvedValue(undefined),
      } as unknown as AccountReferencesService,
    );
    const st = new GetPeriodStatsUseCase(
      accounts as unknown as AccountRepository,
      periods as unknown as PeriodRepository,
      transactions as unknown as TransactionRepository,
      budgets as unknown as BudgetRepository,
      categories as unknown as CategoryRepository,
    );

    const s = await st.execute('acc-1', 'per-1');
    const r = await sim.execute({
      accountId: 'acc-1',
      periodId: 'per-1',
      budgets: [body('A', 80000)],
    });

    expect(s.realExpenses).toBe('-62000');
    expect(s.realIncome).toBe('0');
    expect(r.forecastBalance).toBe(s.forecastBalance);
    expect(r.realExpenses).toBe(s.realExpenses);
    expect(r.realIncome).toBe(s.realIncome);
  });
});
