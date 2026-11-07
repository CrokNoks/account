import { CategoryType } from '../../categories/domain/category.entity';
import { computePeriodForecast, PeriodForecastInput } from './period-forecast';

const B = (n: number) => BigInt(n);

const cats = [
  { id: 'A', type: CategoryType.EXPENSE },
  { id: 'B', type: CategoryType.EXPENSE },
  { id: 'S', type: CategoryType.SAVINGS },
  { id: 'I', type: CategoryType.INCOME },
  { id: 'T', type: CategoryType.TRANSFER },
];

function input(
  real: Record<string, number>,
  budgets: Record<string, number>,
  extra: Partial<PeriodForecastInput> = {},
): PeriodForecastInput {
  return {
    startBalance: B(100000),
    categories: cats,
    realByCategory: new Map(Object.entries(real).map(([k, v]) => [k, B(v)])),
    uncategorized: B(0),
    budgets: Object.entries(budgets).map(([categoryId, amount]) => ({
      categoryId,
      amount: B(amount),
    })),
    ...extra,
  };
}

describe('computePeriodForecast', () => {
  it('expenses: the real wins when it is above the budget', () => {
    expect(
      computePeriodForecast(input({ A: -50000 }, { A: 30000 })).forecastBalance,
    ).toBe(B(50000));
  });

  it('expenses: the budget wins when it is above the real', () => {
    expect(
      computePeriodForecast(input({ A: -30000 }, { A: 50000 })).forecastBalance,
    ).toBe(B(50000));
  });

  it('income: the real wins when it is above the planned', () => {
    expect(
      computePeriodForecast(input({ I: 200000 }, { I: 150000 }))
        .forecastBalance,
    ).toBe(B(300000));
  });

  it('income: the planned wins when it is above the real', () => {
    expect(
      computePeriodForecast(input({ I: 100000 }, { I: 150000 }))
        .forecastBalance,
    ).toBe(B(250000));
  });

  it('transfers count as income', () => {
    expect(
      computePeriodForecast(input({}, { I: 150000, T: 20000 })).forecastBalance,
    ).toBe(B(270000));
  });

  it('savings count as expenses', () => {
    expect(
      computePeriodForecast(input({ S: -10000 }, { S: 40000 })).forecastBalance,
    ).toBe(B(60000));
  });

  it('uncategorized is added at its real amount, outside the budgets', () => {
    const r = computePeriodForecast(
      input({}, { A: 30000 }, { uncategorized: B(-2000) }),
    );
    expect(r.forecastBalance).toBe(B(100000 - 30000 - 2000));
  });

  it('a budget at 0 is the same as no budget', () => {
    const zero = computePeriodForecast(input({ A: -10000 }, { A: 0 }));
    const none = computePeriodForecast(input({ A: -10000 }, {}));
    expect(zero).toEqual(none);
    expect(zero.plannedExpenses).toBe(B(0));
    expect(zero.forecastBalance).toBe(B(90000));
  });

  it('a negative budget counts as its absolute value', () => {
    expect(computePeriodForecast(input({}, { A: -40000 }))).toEqual(
      computePeriodForecast(input({}, { A: 40000 })),
    );
  });

  it('exposes the totals used by the stats', () => {
    const r = computePeriodForecast(
      input({ A: -50000, I: 200000 }, { A: 30000, I: 250000 }),
    );
    expect(r).toMatchObject({
      realIncome: B(200000),
      plannedIncome: B(250000),
      realExpenses: B(-50000),
      plannedExpenses: B(30000),
      maxIncome: B(250000),
      maxAbsExpenses: B(50000),
    });
  });

  it('a category without budget nor real changes nothing', () => {
    expect(computePeriodForecast(input({}, {})).forecastBalance).toBe(
      B(100000),
    );
  });

  describe('effect of a change of budgets (CA3)', () => {
    // A réel -50000, B réel -100000 : réel total 150000.
    const real = { A: -50000, B: -100000 };

    it('lowering a budget below the real changes plannedExpenses but not the forecast', () => {
      const saved = computePeriodForecast(input(real, { A: 80000, B: 30000 }));
      const sim = computePeriodForecast(input(real, { A: 20000, B: 30000 }));
      expect(saved.plannedExpenses).toBe(B(110000));
      expect(sim.plannedExpenses).toBe(B(50000));
      expect(sim.maxAbsExpenses).toBe(saved.maxAbsExpenses);
      expect(sim.forecastBalance).toBe(saved.forecastBalance);
    });

    it('the same change with a high budget on B has an effect', () => {
      const saved = computePeriodForecast(input(real, { A: 80000, B: 100000 }));
      const sim = computePeriodForecast(input(real, { A: 20000, B: 100000 }));
      expect(saved.maxAbsExpenses).toBe(B(180000));
      expect(sim.maxAbsExpenses).toBe(B(150000));
      expect(sim.forecastBalance - saved.forecastBalance).toBe(B(30000));
    });

    it('crossing the real gives a partial effect', () => {
      const saved = computePeriodForecast(input(real, { A: 80000, B: 30000 }));
      const sim = computePeriodForecast(input(real, { A: 130000, B: 30000 }));
      expect(sim.maxAbsExpenses).toBe(B(160000));
      expect(sim.forecastBalance - saved.forecastBalance).toBe(B(-10000));
    });
  });
});
