import { CategoryType } from '../../categories/domain/category.entity';
import {
  computeOverrun,
  computeOverrunsForPeriod,
  OverrunTransaction,
} from './category-overrun';

const E = CategoryType.EXPENSE;
const tx = (
  categoryId: string | null,
  amount: bigint,
  pending = false,
): OverrunTransaction => ({
  categoryId,
  amount,
  pending,
});

describe('computeOverrun', () => {
  it.each([
    ['nominal', E, 10000n, -12000n, 2000n],
    ['égalité exacte', E, 10000n, -10000n, 0n],
    ['juste au-dessus', E, 10000n, -10001n, 1n],
    ['juste en dessous', E, 10000n, -9999n, 0n],
    ['budget négatif', E, -10000n, -12000n, 2000n],
    ['budget positif même réel', E, 10000n, -12000n, 2000n],
    ['épargne', CategoryType.SAVINGS, 5000n, -8000n, 3000n],
    ['budget 0', E, 0n, -5000n, 0n],
    ['revenu réel positif', CategoryType.INCOME, 10000n, 15000n, 0n],
    ['revenu réel négatif', CategoryType.INCOME, 10000n, -15000n, 0n],
    ['virement', CategoryType.TRANSFER, 10000n, -15000n, 0n],
    ['réel positif (remboursements nets)', E, 10000n, 3000n, 0n],
    ['réel nul', E, 10000n, 0n, 0n],
    ['> 2^53', E, 9007199254740993n, -9007199254740995n, 2n],
  ])('%s', (_n, type, budget, real, expected) => {
    expect(computeOverrun(type, budget, real)).toBe(expected);
  });
});

describe('computeOverrunsForPeriod', () => {
  const cats = [{ id: 'c1', type: E }];
  const budgets = new Map([['c1', 10000n]]);

  it('budget absent du Map : budget 0, dépassement 0', () => {
    const r = computeOverrunsForPeriod(cats, new Map(), [tx('c1', -5000n)]);
    expect(r).toEqual([
      { categoryId: 'c1', budget: 0n, real: -5000n, overrun: 0n },
    ]);
  });

  it('budget négatif ramené en valeur absolue', () => {
    const r = computeOverrunsForPeriod(cats, new Map([['c1', -10000n]]), [
      tx('c1', -12000n),
    ]);
    expect(r[0]).toEqual({
      categoryId: 'c1',
      budget: 10000n,
      real: -12000n,
      overrun: 2000n,
    });
  });

  it('exclut les pending', () => {
    const r = computeOverrunsForPeriod(cats, budgets, [
      tx('c1', -8000n),
      tx('c1', -5000n, true),
    ]);
    expect(r[0].real).toBe(-8000n);
    expect(r[0].overrun).toBe(0n);
  });

  it('pending seule : réel 0', () => {
    const r = computeOverrunsForPeriod(cats, budgets, [
      tx('c1', -12000n, true),
    ]);
    expect(r[0].real).toBe(0n);
    expect(r[0].overrun).toBe(0n);
  });

  it('remboursement en déduction', () => {
    const r = computeOverrunsForPeriod(cats, budgets, [
      tx('c1', -15000n),
      tx('c1', 6000n),
    ]);
    expect(r[0].real).toBe(-9000n);
    expect(r[0].overrun).toBe(0n);
  });

  it('remboursement partiel', () => {
    const r = computeOverrunsForPeriod(cats, budgets, [
      tx('c1', -15000n),
      tx('c1', 2000n),
    ]);
    expect(r[0].real).toBe(-13000n);
    expect(r[0].overrun).toBe(3000n);
  });

  it('ignore les transactions sans catégorie', () => {
    const r = computeOverrunsForPeriod(cats, budgets, [tx(null, -50000n)]);
    expect(r[0]).toEqual({
      categoryId: 'c1',
      budget: 10000n,
      real: 0n,
      overrun: 0n,
    });
  });

  it('catégorie sans mouvement', () => {
    expect(computeOverrunsForPeriod(cats, budgets, [])[0].overrun).toBe(0n);
  });

  it('montants > 2^53 exacts', () => {
    const r = computeOverrunsForPeriod(
      cats,
      new Map([['c1', 9007199254740993n]]),
      [tx('c1', -9007199254740995n)],
    );
    expect(r[0].overrun).toBe(2n);
  });

  it('revenus et virements absents, ordre des catégories conservé', () => {
    const r = computeOverrunsForPeriod(
      [
        { id: 'i', type: CategoryType.INCOME },
        { id: 'b', type: CategoryType.SAVINGS },
        { id: 't', type: CategoryType.TRANSFER },
        { id: 'a', type: E },
      ],
      new Map([
        ['i', 10000n],
        ['t', 10000n],
        ['a', 100n],
        ['b', 100n],
      ]),
      [tx('i', -15000n), tx('t', -15000n), tx('a', -300n), tx('b', -200n)],
    );
    expect(r.map((x) => x.categoryId)).toEqual(['b', 'a']);
    expect(r.map((x) => x.overrun)).toEqual([100n, 200n]);
  });
});
