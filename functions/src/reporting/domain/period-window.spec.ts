import { GetPeriodStatsUseCase } from '../application/get-period-stats.use-case';
import { Account } from '../../accounts/domain/account.entity';
import { Period } from '../../periods/domain/period.entity';
import {
  Category,
  CategoryType,
} from '../../categories/domain/category.entity';
import { BudgetInstance } from '../../budgets/domain/budget-instance.entity';
import { Transaction } from '../../transactions/domain/transaction.entity';
import {
  filterPeriodWindow,
  isInPeriodWindow,
  isNextPaie,
  periodLoadEndDate,
  toWindowPeriod,
  WindowPeriod,
  WindowTransaction,
} from './period-window';

const category = (id: string, type: CategoryType) =>
  new Category({
    id,
    name: id,
    color: '#000000',
    type,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

const tx = (
  date: string,
  amount: number,
  o: {
    categoryId?: string | null;
    reconciled?: boolean;
    pending?: boolean;
  } = {},
) =>
  Transaction.create({
    accountId: 'acc-1',
    categoryId: o.categoryId === undefined ? 'courses' : o.categoryId,
    date: d(date),
    description: 'tx',
    amount: BigInt(amount),
    reconciled: o.reconciled ?? false,
    pending: o.pending ?? false,
  });

/**
 * Faux dépôt qui se comporte comme la base : filtre par startDate / endDate
 * demandés, et somme des transactions avant une date.
 */
const run = async (
  period: Period,
  all: Transaction[],
  budgets: BudgetInstance[] = [],
) => {
  const useCase = new GetPeriodStatsUseCase(
    {
      findById: jest.fn().mockResolvedValue(
        new Account({
          id: 'acc-1',
          name: 'Courant',
          ownerId: 'u-1',
          initialBalance: BigInt(100000),
        }),
      ),
    } as never,
    { findById: jest.fn().mockResolvedValue(period) } as never,
    {
      sumAmountsBeforeDateByBalance: jest.fn((_: string, before: Date) => {
        const sum = (f: (t: Transaction) => boolean) =>
          all
            .filter((t) => t.date < before && f(t))
            .reduce((n, t) => n + t.amount, BigInt(0));
        return Promise.resolve({
          all: sum(() => true),
          reconciled: sum((t) => t.reconciled),
          nonPending: sum((t) => !t.pending),
        });
      }),
      findAllByAccountUnpaginated: jest.fn(
        (_: string, o?: { startDate?: Date; endDate?: Date }) =>
          Promise.resolve(
            all.filter(
              (t) =>
                (!o?.startDate || t.date >= o.startDate) &&
                (!o?.endDate || t.date <= o.endDate),
            ),
          ),
      ),
    } as never,
    { findAllByPeriod: jest.fn().mockResolvedValue(budgets) } as never,
    {
      findAllByAccount: jest
        .fn()
        .mockResolvedValue([
          category('courses', CategoryType.EXPENSE),
          category('loyer', CategoryType.EXPENSE),
          category('salaire', CategoryType.INCOME),
        ]),
    } as never,
  );
  const s = await useCase.execute('acc-1', period.id);
  const start = BigInt(s.startBalance);
  return {
    start,
    forecast: BigInt(s.forecastBalance) - start,
    // relatifs au solde initial (100 000) : les départs de la banque et de À venir diffèrent de `start`
    bank: BigInt(s.realBankBalance) - 100000n,
    upcoming: BigInt(s.upcomingBalance) - 100000n,
    bills: BigInt(s.billsTotal),
    card: BigInt(s.cardTotal),
    cardCount: s.cardCount,
    composition:
      BigInt(s.realBankBalance) +
      BigInt(s.cardTotal) +
      BigInt(s.billsTotal) +
      BigInt(s.reportsTotal) +
      BigInt(s.budgetRemaining) +
      BigInt(s.expectedIncome),
    forecastAbs: BigInt(s.forecastBalance),
    stats: s,
  };
};

const active = (end: string | null = '2026-11-30') =>
  Period.create({
    id: 'per-1',
    accountId: 'acc-1',
    startDate: d('2026-11-01'),
    endDate: end ? d(end) : null,
    isActive: true,
  });
const closed = () =>
  Period.create({
    id: 'per-1',
    accountId: 'acc-1',
    startDate: d('2026-11-01'),
    endDate: d('2026-11-30'),
    isActive: false,
  });

describe('fenêtre de période : table de la règle critique (15 cas)', () => {
  // Effets de la dépense -12 000 (ou de l'opération) par rapport à « avant ».
  const cases: Array<{
    n: number;
    label: string;
    period: () => Period;
    t: () => Transaction;
    forecast: bigint;
    bank: bigint;
    upcoming: bigint;
    bills: bigint;
    card: bigint;
    cardCount: number;
    /** Le solde de départ contient l'opération (cas 8). */
    inStart?: boolean;
  }> = [
    {
      n: 1,
      label: 'active avec fin, pending 05/12',
      period: active,
      t: () => tx('2026-12-05', -12000, { pending: true }),
      forecast: -12000n,
      bank: 0n,
      upcoming: 0n,
      bills: -12000n,
      card: 0n,
      cardCount: 0,
    },
    {
      n: 2,
      label: 'active avec fin, CB non rapprochée 05/12',
      period: active,
      t: () => tx('2026-12-05', -12000),
      forecast: -12000n,
      bank: 0n,
      upcoming: -12000n,
      bills: 0n,
      card: -12000n,
      cardCount: 1,
    },
    {
      n: 3,
      label: 'active avec fin, rapprochée 05/12',
      period: active,
      t: () => tx('2026-12-05', -12000, { reconciled: true }),
      forecast: -12000n,
      bank: -12000n,
      upcoming: -12000n,
      bills: 0n,
      card: 0n,
      cardCount: 0,
    },
    {
      n: 4,
      label:
        'active avec fin, CB non rapprochée avant le début (31/10) : dans le prévu et À venir, pas en banque',
      period: active,
      t: () => tx('2026-10-31', -12000),
      forecast: 0n,
      bank: 0n,
      upcoming: -12000n,
      bills: 0n,
      card: 0n,
      cardCount: 0,
      inStart: true,
    },
    {
      n: 5,
      label: 'active avec fin, sans catégorie pending 05/12',
      period: active,
      t: () => tx('2026-12-05', -12000, { pending: true, categoryId: null }),
      forecast: -12000n,
      bank: 0n,
      upcoming: 0n,
      bills: -12000n,
      card: 0n,
      cardCount: 0,
    },
    {
      n: 6,
      label: 'active avec fin, datée le jour de la fin (30/11), pending',
      period: active,
      t: () => tx('2026-11-30', -12000, { pending: true }),
      forecast: -12000n,
      bank: 0n,
      upcoming: 0n,
      bills: -12000n,
      card: 0n,
      cardCount: 0,
    },
    {
      n: 7,
      label: 'active avec fin, datée avant la fin (15/11), CB',
      period: active,
      t: () => tx('2026-11-15', -12000),
      forecast: -12000n,
      bank: 0n,
      upcoming: -12000n,
      bills: 0n,
      card: -12000n,
      cardCount: 1,
    },
    {
      n: 8,
      label: 'active avec fin, datée avant le début (31/10) : dans le départ',
      period: active,
      t: () => tx('2026-10-31', -12000, { pending: true }),
      forecast: 0n,
      bank: 0n,
      upcoming: 0n,
      bills: 0n,
      card: 0n,
      cardCount: 0,
      inStart: true,
    },
    {
      n: 9,
      label:
        'active avec fin, revenu non pointé +12 000 le 05/12 : compté (CA2)',
      period: active,
      t: () => tx('2026-12-05', 12000, { categoryId: 'salaire' }),
      forecast: 12000n,
      bank: 0n,
      upcoming: 12000n,
      bills: 0n,
      card: 12000n,
      cardCount: 1,
    },
    {
      n: 10,
      label:
        'active avec fin, revenu pointé +12 000 le 05/12 : dans la fenêtre, en banque, à venir et au prévu',
      period: active,
      t: () => tx('2026-12-05', 12000, { reconciled: true }),
      forecast: 12000n,
      bank: 12000n,
      upcoming: 12000n,
      bills: 0n,
      card: 0n,
      cardCount: 0,
    },
    {
      n: 11,
      label: 'active, fin dépassée (aujourd’hui 05/12), pending 03/12',
      period: active,
      t: () => tx('2026-12-03', -12000, { pending: true }),
      forecast: -12000n,
      bank: 0n,
      upcoming: 0n,
      bills: -12000n,
      card: 0n,
      cardCount: 0,
    },
    {
      n: 12,
      label: 'active sans fin, pending tardif',
      period: () => active(null),
      t: () => tx('2027-03-05', -12000, { pending: true }),
      forecast: -12000n,
      bank: 0n,
      upcoming: 0n,
      bills: -12000n,
      card: 0n,
      cardCount: 0,
    },
    {
      n: 13,
      label: 'fermée, dépense datée 05/12 : non comptée',
      period: closed,
      t: () => tx('2026-12-05', -12000),
      forecast: 0n,
      bank: 0n,
      upcoming: 0n,
      bills: 0n,
      card: 0n,
      cardCount: 0,
    },
    {
      n: 14,
      label: 'fermée, dépense datée 20/11, CB',
      period: closed,
      t: () => tx('2026-11-20', -12000),
      forecast: -12000n,
      bank: 0n,
      upcoming: -12000n,
      bills: 0n,
      card: -12000n,
      cardCount: 1,
    },
    {
      n: 15,
      label:
        'active avec fin, salaire pointé +12 000 le 05/12 : dans la fenêtre (exemple F)',
      period: active,
      t: () =>
        tx('2026-12-05', 12000, { categoryId: 'salaire', reconciled: true }),
      forecast: 12000n,
      bank: 12000n,
      upcoming: 12000n,
      bills: 0n,
      card: 0n,
      cardCount: 0,
    },
  ];

  it.each(cases)('cas $n : $label', async (c) => {
    const r = await run(c.period(), [c.t()]);
    expect(r.start).toBe(c.inStart ? 88000n : 100000n);
    expect({
      forecast: r.forecast,
      bank: r.bank,
      upcoming: r.upcoming,
      bills: r.bills,
      card: r.card,
      cardCount: r.cardCount,
    }).toEqual({
      forecast: c.forecast,
      bank: c.bank,
      upcoming: c.upcoming,
      bills: c.bills,
      card: c.card,
      cardCount: c.cardCount,
    });
    // composition = prévu au centime
    expect(r.composition).toBe(r.forecastAbs);
  });

  it('cas chiffré : Courses 40 000 de budget, facture Loyer pending après la fin', async () => {
    const budget = BudgetInstance.create({
      periodId: 'per-1',
      categoryId: 'courses',
      amountAllocated: BigInt(40000),
    });
    const r = await run(
      active(),
      [
        tx('2026-11-10', -30000, { reconciled: true }),
        tx('2026-11-20', -5000),
        tx('2026-12-05', -12000, { categoryId: 'loyer', pending: true }),
      ],
      [budget],
    );
    // par catégorie : Courses max(35000, 40000) + Loyer 12000 = 52000
    expect(r.forecastAbs).toBe(48000n);
    expect(r.stats.realBankBalance).toBe('70000');
    expect(r.stats.upcomingBalance).toBe('65000');
    expect(r.card).toBe(-5000n);
    expect(r.bills).toBe(-12000n);
    expect(BigInt(r.stats.budgetRemaining)).toBe(-5000n);
    expect(r.composition).toBe(48000n);
  });
});

describe('isInPeriodWindow : table de cas de la conception', () => {
  const T = 'paie';
  const P = (
    o: Partial<WindowPeriod> & { closed?: boolean } = {},
  ): WindowPeriod => ({
    startDate: d('2026-11-01'),
    endDate: d('2026-11-30'),
    isActive: !o.closed,
    triggerCategoryId: T,
    ...o,
  });
  const W = (
    date: string,
    o: Partial<WindowTransaction> = {},
  ): WindowTransaction => ({
    date: d(date),
    pending: false,
    categoryId: 'courses',
    metadata: {},
    ...o,
  });
  const paie = (date: string, o: Partial<WindowTransaction> = {}) =>
    W(date, {
      pending: true,
      categoryId: T,
      metadata: { recurringId: 'rec-1' },
      ...o,
    });

  it.each<[string, () => WindowTransaction, () => WindowPeriod, boolean]>([
    [
      'fermée, date = début',
      () => W('2026-11-01'),
      () => P({ closed: true }),
      true,
    ],
    [
      'fermée, date = fin',
      () => W('2026-11-30'),
      () => P({ closed: true }),
      true,
    ],
    [
      'fermée, veille du début',
      () => W('2026-10-31'),
      () => P({ closed: true }),
      false,
    ],
    [
      'fermée, lendemain de la fin',
      () => W('2026-12-01'),
      () => P({ closed: true }),
      false,
    ],
    [
      'fermée, revenu pointé après la fin',
      () => W('2026-12-05', { categoryId: 'revenus' }),
      () => P({ closed: true }),
      false,
    ],
    ['active, dépense après la fin', () => W('2026-12-05'), () => P(), true],
    [
      'active, revenu non pointé après la fin (sans catégorie déclencheuse)',
      () => W('2026-12-05', { categoryId: 'revenus' }),
      () => P(),
      true,
    ],
    [
      'active, revenu pointé après la fin',
      () => W('2026-12-05', { categoryId: 'revenus' }),
      () => P(),
      true,
    ],
    [
      'active, paie pending + recurringId à fin + 1',
      () => paie('2026-12-01'),
      () => P(),
      false,
    ],
    ['active, même paie à la fin', () => paie('2026-11-30'), () => P(), true],
    [
      'active, paie pending dans la période',
      () => paie('2026-11-15'),
      () => P(),
      true,
    ],
    [
      'active, paie pointée après la fin',
      () => paie('2026-12-05', { pending: false }),
      () => P(),
      true,
    ],
    [
      'active, paie pending sans recurringId après la fin',
      () => paie('2026-12-05', { metadata: {} }),
      () => P(),
      true,
    ],
    [
      'active, paie pending avec recurringId vide',
      () => paie('2026-12-05', { metadata: { recurringId: '' } }),
      () => P(),
      true,
    ],
    [
      'active, pending + recurringId d’une autre catégorie après la fin',
      () => paie('2026-12-05', { categoryId: 'loyer' }),
      () => P(),
      true,
    ],
    [
      'active sans fin, paie pending + recurringId à J+60',
      () => paie('2027-01-29'),
      () => P({ endDate: null }),
      true,
    ],
    [
      'active sans catégorie déclencheuse, paie pending après la fin',
      () => paie('2026-12-05'),
      () => P({ triggerCategoryId: null }),
      true,
    ],
    ['active, date < début', () => W('2026-10-31'), () => P(), false],
    [
      'fermée sans fin : tout ce qui suit le début compte (comportement gardé, documenté)',
      () => W('2027-01-10'),
      () => P({ closed: true, endDate: null }),
      true,
    ],
  ])('%s', (_l, t, period, expected) => {
    expect(isInPeriodWindow(t(), period())).toBe(expected);
  });

  it('isNextPaie : pas de condition sur le montant ni sur le pointage, période fermée jamais', () => {
    expect(isNextPaie(paie('2026-12-01'), P())).toBe(true);
    expect(isNextPaie(paie('2026-12-01'), P({ closed: true }))).toBe(false);
    expect(isNextPaie(paie('2026-12-01', { pending: false }), P())).toBe(false);
  });

  it('filterPeriodWindow sur 3 périodes consécutives fermées : chaque transaction dans une seule', () => {
    const periods: WindowPeriod[] = [
      P({ closed: true, startDate: d('2026-09-01'), endDate: d('2026-09-30') }),
      P({ closed: true, startDate: d('2026-10-01'), endDate: d('2026-10-31') }),
      P({ closed: true, startDate: d('2026-11-01'), endDate: d('2026-11-30') }),
    ];
    const txs = [
      '2026-09-01',
      '2026-09-30',
      '2026-10-01',
      '2026-10-31',
      '2026-11-01',
      '2026-11-30',
    ].map((x) => W(x));
    const counts = txs.map(
      (t) => periods.filter((p) => filterPeriodWindow([t], p).length).length,
    );
    expect(counts).toEqual([1, 1, 1, 1, 1, 1]);
  });

  it('periodLoadEndDate : active sans borne haute, fermée avec sa fin, fermée sans fin sans borne', () => {
    expect(periodLoadEndDate(P())).toBeUndefined();
    expect(periodLoadEndDate(P({ closed: true }))).toEqual(d('2026-11-30'));
    expect(
      periodLoadEndDate(P({ closed: true, endDate: null })),
    ).toBeUndefined();
  });

  it('toWindowPeriod prend la catégorie déclencheuse du compte', () => {
    const cats = [
      category('courses', CategoryType.EXPENSE),
      new Category({
        id: 'paie',
        name: 'paie',
        color: '#000000',
        type: CategoryType.INCOME,
        isPeriodTrigger: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ];
    const per = Period.create({
      accountId: 'acc-1',
      startDate: d('2026-11-01'),
      endDate: d('2026-11-30'),
      isActive: true,
    });
    expect(toWindowPeriod(per, cats).triggerCategoryId).toBe('paie');
    expect(toWindowPeriod(per, cats.slice(0, 1)).triggerCategoryId).toBeNull();
  });
});
