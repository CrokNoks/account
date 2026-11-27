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

  describe('net refund on expense categories (real > 0)', () => {
    it('without budget, the refund adds to the forecast instead of counting as a spending', () => {
      const r = computePeriodForecast(input({ A: 10000 }, {}));
      expect(r.forecastBalance).toBe(B(110000));
      expect(r.maxAbsExpenses).toBe(B(0));
    });

    // Cas ambigu, choix à valider : départ 100000, réel +10000, prévu 50000.
    // Règle décidée par Lucas : budget entier encore à dépenser + remboursement = 60000.
    it('with a budget, the whole budget is still to spend and the refund comes on top', () => {
      const r = computePeriodForecast(input({ A: 10000 }, { A: 50000 }));
      expect(r.forecastBalance).toBe(B(60000));
    });

    it('a refund on one category does not offset the spending of another (sum of categories)', () => {
      // réel net des dépenses : -30000 + 10000 = -20000, budgets 0
      const r = computePeriodForecast(input({ A: -30000, B: 10000 }, {}));
      expect(r.forecastBalance).toBe(B(80000));
    });
  });

  describe('effect of a change of budgets, by category (CA5, CA8)', () => {
    // A réel -50000, B réel -100000.
    const real = { A: -50000, B: -100000 };

    it('lowering a budget that is already below the real changes nothing', () => {
      const saved = computePeriodForecast(input(real, { A: 40000, B: 30000 }));
      const sim = computePeriodForecast(input(real, { A: 20000, B: 30000 }));
      expect(sim.maxAbsExpenses).toBe(saved.maxAbsExpenses);
      expect(sim.forecastBalance).toBe(saved.forecastBalance);
    });

    it('lowering a budget above the real has an effect, even if another category exceeds its budget', () => {
      // Avant (max sur le total) : B dépassée masquait la baisse de A.
      const saved = computePeriodForecast(input(real, { A: 80000, B: 30000 }));
      const sim = computePeriodForecast(input(real, { A: 20000, B: 30000 }));
      expect(saved.maxAbsExpenses).toBe(B(180000)); // 80000 + 100000
      expect(sim.maxAbsExpenses).toBe(B(150000)); // 50000 + 100000
      expect(sim.forecastBalance - saved.forecastBalance).toBe(B(30000));
    });

    it('crossing the real gives a partial effect', () => {
      const saved = computePeriodForecast(input(real, { A: 80000, B: 30000 }));
      const sim = computePeriodForecast(input(real, { A: 130000, B: 30000 }));
      expect(sim.maxAbsExpenses).toBe(B(230000));
      expect(sim.forecastBalance - saved.forecastBalance).toBe(B(-50000));
    });
  });

  describe('max by category, expenses (CA5, examples B, D, E)', () => {
    it('B: an overrun is no longer hidden by an unspent budget', () => {
      // courses -500/300, loyer 0/800 (en centimes x100)
      const r = computePeriodForecast(
        input({ A: -50000 }, { A: 30000, B: 80000 }),
      );
      expect(r.maxAbsExpenses).toBe(B(130000));
      expect(r.forecastBalance).toBe(B(100000 - 130000));
    });

    it('D: a negative budget counts as its absolute value, with the real above or below', () => {
      expect(
        computePeriodForecast(input({ A: -25000 }, { A: -20000 }))
          .maxAbsExpenses,
      ).toBe(B(25000));
      expect(
        computePeriodForecast(input({ A: -15000 }, { A: -20000 }))
          .maxAbsExpenses,
      ).toBe(B(20000));
    });

    it('E: a refund keeps the budget whole and adds on top, per category', () => {
      // courses -500/300, loyer 0/800, loisirs +50/200 (loisirs = S, épargne côté dépenses)
      const r = computePeriodForecast(
        input({ A: -50000, S: 5000 }, { A: 30000, B: 80000, S: 20000 }),
      );
      expect(r.maxAbsExpenses).toBe(B(150000));
      expect(r.refundSurplus).toBe(B(5000));
      expect(r.forecastBalance).toBe(B(100000 - 150000 + 5000));
    });

    it('E2: a refund without budget still adds to the forecast', () => {
      const r = computePeriodForecast(input({ A: 5000 }, {}));
      expect(r.maxAbsExpenses).toBe(B(0));
      expect(r.refundSurplus).toBe(B(5000));
    });

    it('savings -80 / 50 counts on the expense side, a transfer 100 / 0 on the income side (H2)', () => {
      const r = computePeriodForecast(
        input({ S: -8000, T: 10000 }, { S: 5000 }),
      );
      expect(r.maxAbsExpenses).toBe(B(8000));
      expect(r.maxIncome).toBe(B(10000));
    });

    it('H1: a category without transaction nor budget changes nothing', () => {
      const r = computePeriodForecast(input({ A: 0 }, { A: 0, I: 0 }));
      expect(r.maxAbsExpenses).toBe(B(0));
      expect(r.maxIncome).toBe(B(0));
      expect(r.budgetRemaining).toBe(B(0));
      expect(r.expectedIncome).toBe(B(0));
    });

    it('H3: a budget on a category absent from the list is ignored', () => {
      const r = computePeriodForecast(input({}, { UNKNOWN: 90000 }));
      expect(r.forecastBalance).toBe(B(100000));
      expect(r.plannedExpenses).toBe(B(0));
    });
  });

  describe('max by category, income (CA6, examples C, G)', () => {
    const two = [
      ...cats,
      { id: 'I2', type: CategoryType.INCOME },
      { id: 'I3', type: CategoryType.INCOME },
    ];

    it('C: salary 2000/2000, bonus 0/300, freelance 400/0 give 2700 retained and 300 expected', () => {
      const r = computePeriodForecast(
        input(
          { I: 200000, I3: 40000 },
          { I: 200000, I2: 30000 },
          { categories: two },
        ),
      );
      expect(r.maxIncome).toBe(B(270000));
      expect(r.expectedIncome).toBe(B(30000));
      expect(r.forecastBalance).toBe(B(100000 + 270000));
    });

    it('G: a negative real keeps the budget whole and deducts the negative (retained 1950, expected 2000)', () => {
      const r = computePeriodForecast(input({ I: -5000 }, { I: 200000 }));
      expect(r.maxIncome).toBe(B(195000));
      expect(r.expectedIncome).toBe(B(200000));
    });

    it('G2: with the bonus 0/300 in addition, retained 2250', () => {
      const r = computePeriodForecast(
        input({ I: -5000 }, { I: 200000, I2: 30000 }, { categories: two }),
      );
      expect(r.maxIncome).toBe(B(225000));
    });

    it('Virement CJ : a transfer with a negative real is an outgoing transfer, budget ignored (retained = real, expected 0)', () => {
      const r = computePeriodForecast(input({ T: -203248 }, { T: 203248 }));
      expect(r.maxIncome).toBe(B(-203248));
      expect(r.expectedIncome).toBe(B(0));
      expect(r.forecastBalance).toBe(B(100000 - 203248));
    });

    it('a transfer with a positive real keeps max(real, |budget|)', () => {
      expect(
        computePeriodForecast(input({ T: 10000 }, { T: 20000 })).maxIncome,
      ).toBe(B(20000));
    });

    it('a negative real without budget stays negative (retained = real)', () => {
      const r = computePeriodForecast(input({ I: -5000 }, {}));
      expect(r.maxIncome).toBe(B(-5000));
      expect(r.expectedIncome).toBe(B(0));
    });

    it('an income budget stored negative counts as its absolute value', () => {
      expect(
        computePeriodForecast(input({ I: 100000 }, { I: -150000 })).maxIncome,
      ).toBe(B(150000));
    });
  });

  describe('budget remaining and expected income, by category (CA7)', () => {
    it('C1: the remaining budget is the sum of the leftovers per category, not of the total', () => {
      // A dépasse (-500/300), B intact (0/800) : reste = -(0 + 800)
      const r = computePeriodForecast(
        input({ A: -50000 }, { A: 30000, B: 80000 }),
      );
      expect(r.budgetRemaining).toBe(B(-80000));
    });

    it('a refund does not enter the remaining budget (the budget stays whole)', () => {
      const r = computePeriodForecast(input({ A: 5000 }, { A: 30000 }));
      expect(r.budgetRemaining).toBe(B(-30000));
    });
  });

  describe("sens d'un virement : tableau de la conception (euros en centimes, départ 0)", () => {
    // CJ = virement sortant (budget négatif), Salaire = entrant (budget positif).
    const tcats = [
      { id: 'CJ', type: CategoryType.TRANSFER },
      { id: 'SAL', type: CategoryType.TRANSFER },
      { id: 'DEP', type: CategoryType.EXPENSE },
    ];
    const run = (
      real: Record<string, number>,
      budgets: Record<string, number>,
    ) =>
      computePeriodForecast({
        startBalance: B(0),
        categories: tcats,
        realByCategory: new Map(
          Object.entries(real).map(([k, v]) => [k, B(v)]),
        ),
        uncategorized: B(0),
        budgets: Object.entries(budgets).map(([categoryId, amount]) => ({
          categoryId,
          amount: B(amount),
        })),
      });

    // [libellé, réel, budgets, prévu attendu]
    const rows: Array<
      [string, Record<string, number>, Record<string, number>, number]
    > = [
      ['1 CJ non parti (CA1)', {}, { CJ: -203248 }, -203248],
      ['2 CJ parti en entier', { CJ: -203248 }, { CJ: -203248 }, -203248],
      [
        '3 CJ parti en partie : le reste est dû',
        { CJ: -100000 },
        { CJ: -203248 },
        -203248,
      ],
      ['4 CJ parti plus que prévu', { CJ: -210000 }, { CJ: -203248 }, -210000],
      ['5 Salaire pas arrivé (CA2)', {}, { SAL: 203300 }, 203300],
      ['6 Salaire arrivé', { SAL: 203300 }, { SAL: 203300 }, 203300],
      [
        '7 Salaire qui revient négatif : budget ignoré (décision 1)',
        { SAL: -5000 },
        { SAL: 203300 },
        -5000,
      ],
      ['8 sans budget, réel -500', { CJ: -50000 }, {}, -50000],
      ['9 budget remis à 0, réel -500', { CJ: -50000 }, { CJ: 0 }, -50000],
      [
        '10 CJ sortant à réel positif : remboursement',
        { CJ: 30000 },
        { CJ: -203248 },
        -173248,
      ],
      ['11 ni budget ni opération', {}, {}, 0],
      [
        '12 mélange CJ -2032,48 + Salaire 2033,00 + dépense 500 (réel 0)',
        {},
        { CJ: -203248, SAL: 203300, DEP: 50000 },
        -49948,
      ],
    ];

    it.each(rows)('%s', (_label, real, budgets, expected) => {
      const f = run(real, budgets);
      expect(f.forecastBalance).toBe(B(expected));

      // Égalité de la composition au centime (CA3) :
      // départ + total de la fenêtre + revenus attendus + budget restant = prévu.
      const windowTotal = Object.values(real).reduce((a, v) => a + B(v), B(0));
      expect(f.forecastBalance).toBe(
        B(0) + windowTotal + f.expectedIncome + f.budgetRemaining,
      );
    });

    it('CJ non parti : le prévu baisse de 2032,48 par rapport au même compte sans budget CJ', () => {
      const sans = run({}, { DEP: 50000 });
      const avec = run({}, { CJ: -203248, DEP: 50000 });
      expect(avec.forecastBalance - sans.forecastBalance).toBe(B(-203248));
    });

    it('CJ non parti : classé dans budgetRemaining, plus dans expectedIncome (CA3)', () => {
      const f = run({}, { CJ: -203248 });
      expect(f.budgetRemaining).toBe(B(-203248));
      expect(f.expectedIncome).toBe(B(0));
    });

    it('CJ parti en partie : le reste dû (1032,48) est dans budgetRemaining', () => {
      const f = run({ CJ: -100000 }, { CJ: -203248 });
      expect(f.budgetRemaining).toBe(B(-103248));
      expect(f.expectedIncome).toBe(B(0));
    });

    it('Salaire pas arrivé : revenu attendu, rien dans le budget restant', () => {
      const f = run({}, { SAL: 203300 });
      expect(f.expectedIncome).toBe(B(203300));
      expect(f.budgetRemaining).toBe(B(0));
    });

    it('12 : totaux par sens et dépenses hors virements (CA5, CA9)', () => {
      const f = run({}, { CJ: -203248, SAL: 203300, DEP: 50000 });
      expect(f.plannedIncome).toBe(B(203300));
      expect(f.plannedExpenses).toBe(B(253248));
      expect(f.plannedExpensesExTransfers).toBe(B(50000));
    });

    it('un virement sans budget ne change aucun total prévu', () => {
      const f = run({ CJ: -50000, SAL: 10000 }, {});
      expect(f.plannedIncome).toBe(B(0));
      expect(f.plannedExpenses).toBe(B(0));
      expect(f.plannedExpensesExTransfers).toBe(B(0));
    });
  });

  describe('invariant : forecast = start + window total + expected - remaining (grille)', () => {
    const grid = [-60000, -5000, 0, 3000, 40000];
    const budgetsGrid = [0, 2000, -30000, 50000];
    it('holds on every combination of real and budget per category', () => {
      let count = 0;
      for (const rA of grid)
        for (const rB of grid)
          for (const rI of grid)
            for (const rT of grid)
              for (const bA of budgetsGrid)
                for (const bI of budgetsGrid) {
                  const real = { A: rA, B: rB, I: rI, T: rT };
                  const r = computePeriodForecast(
                    input(
                      real,
                      { A: bA, B: bA, I: bI, T: bI },
                      {
                        uncategorized: B(-700),
                      },
                    ),
                  );
                  const windowTotal = B(rA + rB + rI + rT - 700);
                  expect(r.forecastBalance).toBe(
                    B(100000) +
                      windowTotal +
                      r.expectedIncome +
                      r.budgetRemaining,
                  );
                  count++;
                }
      expect(count).toBe(5 * 5 * 5 * 5 * 4 * 4);
    });
  });
});

describe('computePeriodForecast — remainingByCategory (détail du budget restant)', () => {
  const detail = (
    real: Record<string, number>,
    budgets: Record<string, number>,
  ) => {
    const r = computePeriodForecast(input(real, budgets));
    const sum = r.remainingByCategory.reduce((s, l) => s + l.remaining, B(0));
    expect(sum).toBe(-r.budgetRemaining);
    return r.remainingByCategory.map((l) => [
      l.categoryId,
      Number(l.remaining),
    ]);
  };

  it('dépense budget 100,00 réel -30,00 : ligne 70,00', () => {
    expect(detail({ A: -3000 }, { A: 10000 })).toEqual([['A', 7000]]);
  });

  it('remboursement +20,00 : ligne 100,00 (pas 120,00)', () => {
    expect(detail({ A: 2000 }, { A: 10000 })).toEqual([['A', 10000]]);
  });

  it('dépassement : pas de ligne', () => {
    expect(detail({ A: -13000 }, { A: 10000 })).toEqual([]);
  });

  it('épuisée : pas de ligne', () => {
    expect(detail({ A: -10000 }, { A: 10000 })).toEqual([]);
  });

  it('budget 0 : pas de ligne, réel -10,00 ou nul', () => {
    expect(detail({ A: -1000 }, { A: 0 })).toEqual([]);
    expect(detail({}, { A: 0 })).toEqual([]);
  });

  it('budget stocké négatif -100,00, réel -30,00 : ligne 70,00', () => {
    expect(detail({ A: -3000 }, { A: -10000 })).toEqual([['A', 7000]]);
  });

  it('épargne budget 50,00 réel 0 : ligne 50,00', () => {
    expect(detail({}, { S: 5000 })).toEqual([['S', 5000]]);
  });

  it('virement sortant budget -200,00 réel -50,00 : ligne 150,00', () => {
    expect(detail({ T: -5000 }, { T: -20000 })).toEqual([['T', 15000]]);
  });

  it('virement entrant et revenu : pas de ligne, hors somme', () => {
    expect(detail({}, { T: 20000, I: 100000 })).toEqual([]);
  });

  it('mélange de tous les cas : Σ = -budgetRemaining au centime', () => {
    const r = detail(
      { A: -3333, B: 2000, S: 0, T: -5001, I: 7 },
      { A: 10000, B: -9999, S: 5001, T: -20000, I: 100000 },
    );
    expect(r).toEqual([
      ['A', 6667],
      ['B', 9999],
      ['S', 5001],
      ['T', 14999],
    ]);
  });

  it('aucun budget restant : liste vide, budgetRemaining 0', () => {
    const r = computePeriodForecast(input({ A: -20000 }, { A: 10000 }));
    expect(r.remainingByCategory).toEqual([]);
    expect(r.budgetRemaining).toBe(B(0));
  });
});
