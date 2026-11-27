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
    sumAmountsBeforeDateByBalance: jest.Mock;
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
      sumAmountsBeforeDateByBalance: jest.fn().mockResolvedValue({
        all: BigInt(0),
        reconciled: BigInt(0),
        nonPending: BigInt(0),
      }),
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
      [
        'outgoing transfer budget (negative) next to an income',
        [
          ['T', -203248],
          ['I', 200000],
        ],
      ],
      [
        'outgoing transfer budget and a savings budget',
        [
          ['T', -203248],
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

  describe('effect of the change (sums by category, CA5, CA8)', () => {
    // Départ 100000 ; réel dépenses : A -50000, B -100000, Z -7000 (Z sans budget, 7000 retenus).
    // Enregistré : A 80000, B 30000 -> retenus 80000 + 100000 + 7000 = 187000.
    it('lowering A under the real: only the part above the real has an effect', async () => {
      // simulé : A 20000 -> retenu 50000 (le réel), B 30000 -> 100000 : 157000
      const r = await run([body('A', 20000), body('B', 30000)]);
      expect(r.plannedExpenses).toBe('50000');
      expect(r.expensesEffect).toBe('30000');
      expect(r.incomeEffect).toBe('0');
      expect(r.delta).toBe('30000');
    });

    it('S1 : lowering a budget already under the real has no effect (« Sans effet » côté dépenses)', async () => {
      budgets.findAllByPeriod.mockResolvedValue([
        saved('A', 40000),
        saved('B', 30000),
      ]);
      const r = await run([body('A', 20000), body('B', 30000)]);
      expect(r.plannedExpenses).toBe('50000');
      expect(r.expensesEffect).toBe('0');
      expect(r.delta).toBe('0');
    });

    it('S2 : the same budgets as the saved ones give no delta and no effect', async () => {
      const r = await run([body('A', 80000), body('B', 30000)]);
      expect(r.delta).toBe('0');
      expect(r.incomeEffect).toBe('0');
      expect(r.expensesEffect).toBe('0');
    });

    it('a high budget on B keeps an effect', async () => {
      budgets.findAllByPeriod.mockResolvedValue([
        saved('A', 80000),
        saved('B', 100000),
      ]);
      // enregistré 80000 + 100000 + 7000 ; simulé 50000 + 100000 + 7000
      const r = await run([body('A', 20000), body('B', 100000)]);
      expect(r.expensesEffect).toBe('30000');
      expect(r.delta).toBe('30000');
    });

    it('crossing the real gives a partial effect', async () => {
      const r = await run([body('A', 130000), body('B', 30000)]);
      // simulé 130000 + 100000 + 7000 = 237000 contre 187000
      expect(r.expensesEffect).toBe('-50000');
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

    describe("sens d'un virement (CA4)", () => {
      it('modifier CJ -2032,48 en -2100,00 agit sur le côté dépenses seulement', async () => {
        budgets.findAllByPeriod.mockResolvedValue([saved('T', -203248)]);
        const r = await run([body('T', -210000)]);
        expect(r.expensesEffect).toBe('-6752');
        expect(r.incomeEffect).toBe('0');
        expect(r.delta).toBe('-6752');
      });

      it('CJ modifié à -1000,00 alors que -1500,00 sont partis : « Sans effet » des deux côtés', async () => {
        transactions.findAllByAccountUnpaginated.mockResolvedValue([
          tx(-150000, 'T'),
        ]);
        budgets.findAllByPeriod.mockResolvedValue([saved('T', -203248)]);
        const r = await run([body('T', -100000)]);
        // enregistré : retenu 203248 ; simulé : retenu 150000 (le réel) -> la baisse a un effet de 53248
        expect(r.incomeEffect).toBe('0');
        expect(r.expensesEffect).toBe('53248');
      });

      it('CJ déjà parti au-delà des deux budgets : aucun effet', async () => {
        transactions.findAllByAccountUnpaginated.mockResolvedValue([
          tx(-250000, 'T'),
        ]);
        budgets.findAllByPeriod.mockResolvedValue([saved('T', -203248)]);
        const r = await run([body('T', -100000)]);
        expect(r.incomeEffect).toBe('0');
        expect(r.expensesEffect).toBe('0');
        expect(r.delta).toBe('0');
      });

      it('Salaire +2033,00 -> +2500,00 : effet côté revenus seulement', async () => {
        budgets.findAllByPeriod.mockResolvedValue([saved('T', 203300)]);
        const r = await run([body('T', 250000)]);
        expect(r.incomeEffect).toBe('46700');
        expect(r.expensesEffect).toBe('0');
      });

      it('la simulation des budgets enregistrés (CJ négatif) = les stats : prévu, revenus et dépenses prévus', async () => {
        const list = [
          saved('T', -203248),
          saved('I', 150000),
          saved('A', 80000),
        ];
        budgets.findAllByPeriod.mockResolvedValue(list);
        const r = await run(
          list.map((b) => body(b.categoryId, Number(b.amountAllocated))),
        );
        const s = await stats.execute('acc-1', 'per-1');
        expect(r.forecastBalance).toBe(s.forecastBalance);
        expect(r.plannedIncome).toBe(s.plannedIncome);
        expect(r.plannedExpenses).toBe(s.plannedExpenses);
        expect(r.delta).toBe('0');
      });
    });

    it('S3 : the invariant holds on a grid of budget lists', async () => {
      const amounts = [0, 20000, -60000, 300000];
      for (const a of amounts)
        for (const bb of amounts)
          for (const i of amounts) {
            const r = await run([body('A', a), body('B', bb), body('I', i)]);
            expect(BigInt(r.delta)).toBe(
              BigInt(r.incomeEffect) + BigInt(r.expensesEffect),
            );
            expect(
              BigInt(r.forecastBalance) - BigInt(r.savedForecastBalance),
            ).toBe(BigInt(r.delta));
          }
    });

    it('S4 : the simulated forecast equals the stats once the same budgets are saved (stats + simulation, same inputs)', async () => {
      const list = [body('A', 20000), body('B', 30000), body('I', 250000)];
      const simulated = await run(list);
      budgets.findAllByPeriod.mockResolvedValue([
        saved('A', 20000),
        saved('B', 30000),
        saved('I', 250000),
      ]);
      const after = await stats.execute('acc-1', 'per-1');
      expect(simulated.forecastBalance).toBe(after.forecastBalance);
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
      sumAmountsBeforeDateByBalance: jest.fn().mockResolvedValue({
        all: BigInt(0),
        reconciled: BigInt(0),
        nonPending: BigInt(0),
      }),
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
    expect(s.realIncome).toBe('90000');
    expect(r.forecastBalance).toBe(s.forecastBalance);
    expect(r.realExpenses).toBe(s.realExpenses);
    expect(r.realIncome).toBe(s.realIncome);
  });
});
