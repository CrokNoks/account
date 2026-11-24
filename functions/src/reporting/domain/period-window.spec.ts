import { GetPeriodStatsUseCase } from '../application/get-period-stats.use-case';
import { Account } from '../../accounts/domain/account.entity';
import { Period } from '../../periods/domain/period.entity';
import {
  Category,
  CategoryType,
} from '../../categories/domain/category.entity';
import { BudgetInstance } from '../../budgets/domain/budget-instance.entity';
import { Transaction } from '../../transactions/domain/transaction.entity';
import { isInPeriodWindow, periodLoadEndDate } from './period-window';

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
      sumAmountByAccountBeforeDate: jest.fn((_: string, before: Date) =>
        Promise.resolve(
          all
            .filter((t) => t.date < before)
            .reduce((s, t) => s + t.amount, BigInt(0)),
        ),
      ),
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
    bank: BigInt(s.realBankBalance) - start,
    upcoming: BigInt(s.upcomingBalance) - start,
    bills: BigInt(s.billsTotal),
    card: BigInt(s.cardTotal),
    cardCount: s.cardCount,
    composition:
      BigInt(s.realBankBalance) +
      BigInt(s.cardTotal) +
      BigInt(s.billsTotal) +
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

describe('fenêtre de période : table de la règle critique (14 cas)', () => {
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
      label: 'active avec fin, pending et rapprochée 05/12',
      period: active,
      t: () => tx('2026-12-05', -12000, { pending: true, reconciled: true }),
      forecast: -12000n,
      bank: -12000n,
      upcoming: 0n,
      bills: 0n,
      card: 0n,
      cardCount: 0,
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
      label: 'active avec fin, revenu +12 000 le 05/12 : non compté',
      period: active,
      t: () => tx('2026-12-05', 12000, { categoryId: 'salaire' }),
      forecast: 0n,
      bank: 0n,
      upcoming: 0n,
      bills: 0n,
      card: 0n,
      cardCount: 0,
    },
    {
      n: 10,
      label: 'active avec fin, remboursement +12 000 sur dépense le 05/12',
      period: active,
      t: () => tx('2026-12-05', 12000, { reconciled: true }),
      forecast: 0n,
      bank: 0n,
      upcoming: 0n,
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
    expect(r.forecastAbs).toBe(53000n);
    expect(r.stats.realBankBalance).toBe('70000');
    expect(r.stats.upcomingBalance).toBe('65000');
    expect(r.card).toBe(-5000n);
    expect(r.bills).toBe(-12000n);
    expect(BigInt(r.stats.budgetRemaining)).toBe(0n);
    expect(r.composition).toBe(53000n);
  });
});

describe('isInPeriodWindow / periodLoadEndDate', () => {
  const p = (endDate: string | null, isActive: boolean) => ({
    startDate: d('2026-11-01'),
    endDate: endDate ? d(endDate) : null,
    isActive,
  });
  const t = (date: string, amount: bigint) => ({ date: d(date), amount });

  it.each([
    ['avant le début', t('2026-10-31', -1n), p('2026-11-30', true), false],
    ['jour du début', t('2026-11-01', -1n), p('2026-11-30', false), true],
    [
      'jour de la fin, revenu',
      t('2026-11-30', 1n),
      p('2026-11-30', true),
      true,
    ],
    [
      'dépense après la fin, active',
      t('2026-12-01', -1n),
      p('2026-11-30', true),
      true,
    ],
    [
      'dépense après la fin, fermée',
      t('2026-12-01', -1n),
      p('2026-11-30', false),
      false,
    ],
    [
      'montant nul après la fin, active',
      t('2026-12-01', 0n),
      p('2026-11-30', true),
      false,
    ],
    [
      'revenu après la fin, active',
      t('2026-12-01', 1n),
      p('2026-11-30', true),
      false,
    ],
    ['sans fin, revenu tardif', t('2030-01-01', 1n), p(null, true), true],
  ])('%s', (_l, tr, period, expected) => {
    expect(isInPeriodWindow(tr, period)).toBe(expected);
  });

  it('charge sans borne haute une période active, avec la fin sinon', () => {
    expect(periodLoadEndDate(p('2026-11-30', true))).toBeUndefined();
    expect(periodLoadEndDate(p('2026-11-30', false))).toEqual(d('2026-11-30'));
    expect(periodLoadEndDate(p(null, false))).toBeUndefined();
  });
});
