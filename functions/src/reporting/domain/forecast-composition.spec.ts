import {
  computeBankBalances,
  computeForecastComposition,
} from './forecast-composition';
import { computePeriodForecast } from './period-forecast';
import { CategoryType } from '../../categories/domain/category.entity';

const t = (
  amount: number,
  flags: { reconciled?: boolean; pending?: boolean },
) => ({
  amount: BigInt(amount),
  reconciled: flags.reconciled ?? false,
  pending: flags.pending ?? false,
});

/** Lignes déjà calculées par `computePeriodForecast` (sommes par catégorie). */
const totals = (o: Partial<Record<string, number>> = {}) => ({
  budgetRemaining: BigInt(o.budgetRemaining ?? 0),
  expectedIncome: BigInt(o.expectedIncome ?? 0),
  reportsTotal: BigInt(o.reportsTotal ?? 0),
  lateReconciledIncome: BigInt(o.lateReconciledIncome ?? 0),
});

describe('computeForecastComposition', () => {
  it('cas nominal : CB, factures et les lignes du prévu telles quelles', () => {
    const r = computeForecastComposition({
      transactions: [
        t(200000, { reconciled: true }),
        t(-10000, { reconciled: true }),
        t(-5000, {}),
        t(-8000, { pending: true }),
      ],
      ...totals({ budgetRemaining: -7000, expectedIncome: 50000 }),
    });
    expect(r.cardTotal).toBe(-5000n);
    expect(r.cardCount).toBe(1);
    expect(r.billsTotal).toBe(-8000n);
    expect(r.budgetRemaining).toBe(-7000n);
    expect(r.expectedIncome).toBe(50000n);
  });

  it('reports : repris signés du départ ; arrivé après la fin = -revenu tardif', () => {
    const r = computeForecastComposition({
      transactions: [],
      ...totals({ reportsTotal: -15000, lateReconciledIncome: 30000 }),
    });
    expect(r.reportsTotal).toBe(-15000n);
    expect(r.arrivedAfterEnd).toBe(-30000n);
  });

  it('pas de revenu tardif : arrivé après la fin vaut 0 (jamais -0)', () => {
    const r = computeForecastComposition({ transactions: [], ...totals() });
    expect(r.arrivedAfterEnd).toBe(0n);
  });

  it('reports positif (facture de revenu avant le début) : gardé signé (C2)', () => {
    const r = computeForecastComposition({
      transactions: [],
      ...totals({ reportsTotal: 20000 }),
    });
    expect(r.reportsTotal).toBe(20000n);
  });

  it('pending non rapprochée : jamais dans la CB', () => {
    const r = computeForecastComposition({
      transactions: [t(-3000, { pending: true }), t(-700, {})],
      ...totals(),
    });
    expect(r.billsTotal).toBe(-3000n);
    expect(r.cardTotal).toBe(-700n);
    expect(r.cardCount).toBe(1);
  });

  it('une transaction rapprochée n’a pas de ligne propre (déjà en banque)', () => {
    const r = computeForecastComposition({
      transactions: [t(-8000, { reconciled: true })],
      ...totals(),
    });
    expect(r.billsTotal).toBe(0n);
    expect(r.cardTotal).toBe(0n);
    expect(r.cardCount).toBe(0);
  });

  it('CB positive (remboursement en CB) : total positif, compté', () => {
    const r = computeForecastComposition({
      transactions: [t(-5000, {}), t(9000, {})],
      ...totals(),
    });
    expect(r.cardTotal).toBe(4000n);
    expect(r.cardCount).toBe(2);
  });

  it('C3 : période vide, tout à zéro', () => {
    const r = computeForecastComposition({ transactions: [], ...totals() });
    expect(r).toEqual({
      cardTotal: 0n,
      cardCount: 0,
      billsTotal: 0n,
      reportsTotal: 0n,
      arrivedAfterEnd: 0n,
      budgetRemaining: 0n,
      expectedIncome: 0n,
    });
  });
});

describe('computeBankBalances', () => {
  it('En banque = départ pointé + pointées de la fenêtre + revenu tardif', () => {
    const r = computeBankBalances({
      startReconciled: 120000n,
      startNonPending: 114000n,
      transactions: [
        t(200000, { reconciled: true }),
        t(-5000, {}),
        t(-8000, { pending: true }),
      ],
      lateReconciledIncome: 30000n,
    });
    expect(r.realBankBalance).toBe(350000n);
  });

  it('À venir = départ non pending + non pending de la fenêtre + revenu tardif', () => {
    const r = computeBankBalances({
      startReconciled: 120000n,
      startNonPending: 114000n,
      transactions: [
        t(200000, { reconciled: true }),
        t(-5000, {}),
        t(-8000, { pending: true }),
      ],
      lateReconciledIncome: 30000n,
    });
    expect(r.upcomingBalance).toBe(114000n + 200000n - 5000n + 30000n);
  });
});

/**
 * Règle critique (CA7) : banque + CB + factures + reports + arrivé après la fin
 * + budget restant + revenus attendus = prévu, au centime. La composition est
 * recalculée ici comme les stats le font, à partir des mêmes briques.
 */
describe('égalité de la composition (CA7)', () => {
  const cats = [
    { id: 'courses', type: CategoryType.EXPENSE },
    { id: 'loyer', type: CategoryType.EXPENSE },
    { id: 'resto', type: CategoryType.EXPENSE },
    { id: 'salaire', type: CategoryType.INCOME },
    { id: 'prime', type: CategoryType.INCOME },
    { id: 'virement', type: CategoryType.TRANSFER },
  ];

  interface Tx {
    amount: number;
    categoryId: string | null;
    reconciled?: boolean;
    pending?: boolean;
  }
  interface Scenario {
    initial: number;
    /** Avant le début de la période. */
    before: Tx[];
    /** Dans la fenêtre. */
    window: Tx[];
    /** Revenus pointés datés après la fin (période active). */
    late: Tx[];
    budgets: Record<string, number>;
  }

  const sum = (xs: Tx[], f: (x: Tx) => boolean = () => true) =>
    xs.filter(f).reduce((n, x) => n + BigInt(x.amount), 0n);

  function evaluate(sc: Scenario) {
    const rec = (x: Tx) => !!x.reconciled;
    const nonPending = (x: Tx) => !x.pending;
    const startAll = BigInt(sc.initial) + sum(sc.before);
    const startRec = BigInt(sc.initial) + sum(sc.before, rec);
    const startNonPending = BigInt(sc.initial) + sum(sc.before, nonPending);
    const lateReconciledIncome = sum(sc.late);

    const realByCategory = new Map<string, bigint>();
    let uncategorized = 0n;
    for (const x of sc.window) {
      if (x.categoryId)
        realByCategory.set(
          x.categoryId,
          (realByCategory.get(x.categoryId) ?? 0n) + BigInt(x.amount),
        );
      else uncategorized += BigInt(x.amount);
    }
    const forecast = computePeriodForecast({
      startBalance: startAll,
      categories: cats,
      realByCategory,
      uncategorized,
      budgets: Object.entries(sc.budgets).map(([categoryId, amount]) => ({
        categoryId,
        amount: BigInt(amount),
      })),
    });
    const windowTx = sc.window.map((x) => ({
      amount: BigInt(x.amount),
      reconciled: !!x.reconciled,
      pending: !!x.pending,
    }));
    const composition = computeForecastComposition({
      transactions: windowTx,
      reportsTotal: startAll - startRec,
      lateReconciledIncome,
      budgetRemaining: forecast.budgetRemaining,
      expectedIncome: forecast.expectedIncome,
    });
    const bank = computeBankBalances({
      startReconciled: startRec,
      startNonPending,
      transactions: windowTx,
      lateReconciledIncome,
    });
    const total =
      bank.realBankBalance +
      composition.cardTotal +
      composition.billsTotal +
      composition.reportsTotal +
      composition.arrivedAfterEnd +
      composition.budgetRemaining +
      composition.expectedIncome;
    return { forecast, composition, bank, total };
  }

  // Exemple A (en centimes) : P1 fermée avant, P2 active.
  const exampleA = (): Scenario => ({
    initial: 0,
    before: [
      { amount: 200000, categoryId: 'salaire', reconciled: true },
      { amount: -80000, categoryId: 'loyer', reconciled: true },
      { amount: -6000, categoryId: 'resto' }, // CB non pointée
      { amount: -9000, categoryId: 'loyer', pending: true }, // facture
    ],
    window: [
      { amount: 200000, categoryId: 'salaire', reconciled: true },
      { amount: -30000, categoryId: 'courses', reconciled: true },
      { amount: -4000, categoryId: 'resto' },
      { amount: -80000, categoryId: 'loyer', pending: true },
    ],
    late: [],
    budgets: { salaire: 200000, courses: 40000, resto: 10000, loyer: 80000 },
  });

  it('A : 2 900 - 40 - 800 - 150 + 0 - 160 + 0 = 1 750', () => {
    const r = evaluate(exampleA());
    expect(r.bank.realBankBalance).toBe(290000n);
    expect(r.bank.upcomingBalance).toBe(280000n);
    expect(r.composition.cardTotal).toBe(-4000n);
    expect(r.composition.billsTotal).toBe(-80000n);
    expect(r.composition.reportsTotal).toBe(-15000n);
    expect(r.composition.arrivedAfterEnd).toBe(0n);
    expect(r.composition.budgetRemaining).toBe(-16000n);
    expect(r.composition.expectedIncome).toBe(0n);
    expect(r.forecast.forecastBalance).toBe(175000n);
    expect(r.total).toBe(r.forecast.forecastBalance);
  });

  it('F : prime +300 pointée après la fin : 3 200 - 40 - 800 - 150 - 300 - 160 + 0 = 1 750', () => {
    const sc = exampleA();
    sc.late = [{ amount: 30000, categoryId: 'prime', reconciled: true }];
    const r = evaluate(sc);
    expect(r.bank.realBankBalance).toBe(320000n);
    expect(r.bank.upcomingBalance).toBe(310000n);
    expect(r.composition.arrivedAfterEnd).toBe(-30000n);
    expect(r.forecast.forecastBalance).toBe(175000n); // prévu inchangé
    expect(r.total).toBe(r.forecast.forecastBalance);
  });

  it('G : salaire -50 / budget 2 000 (revenus attendus 2 000, égalité tenue)', () => {
    const sc = exampleA();
    sc.window = [{ amount: -5000, categoryId: 'salaire', reconciled: true }];
    sc.budgets = { salaire: 200000 };
    const r = evaluate(sc);
    expect(r.composition.expectedIncome).toBe(200000n);
    expect(r.forecast.maxIncome).toBe(195000n);
    expect(r.total).toBe(r.forecast.forecastBalance);
  });

  it('B-E : max par catégorie (dépassement, remboursement, revenu attendu), égalité tenue', () => {
    const sc: Scenario = {
      initial: 10000,
      before: [],
      window: [
        { amount: -50000, categoryId: 'courses', reconciled: true },
        { amount: 5000, categoryId: 'resto', reconciled: true }, // remboursement
        { amount: 200000, categoryId: 'salaire', reconciled: true },
        { amount: 40000, categoryId: 'virement' }, // freelance non budgété
      ],
      late: [],
      budgets: {
        courses: 30000,
        loyer: 80000,
        resto: 20000,
        salaire: 200000,
        prime: 30000,
      },
    };
    const r = evaluate(sc);
    expect(r.composition.expectedIncome).toBe(30000n);
    expect(r.total).toBe(r.forecast.forecastBalance);
  });

  it('Virement CJ : virement sortant à réel négatif, égalité tenue, rien d’attendu', () => {
    const sc: Scenario = {
      initial: 0,
      before: [],
      window: [
        { amount: -203248, categoryId: 'virement', reconciled: true },
        { amount: 540103, categoryId: 'salaire', reconciled: true },
      ],
      late: [],
      budgets: { virement: 203248 },
    };
    const r = evaluate(sc);
    expect(r.composition.expectedIncome).toBe(0n);
    expect(r.forecast.maxIncome).toBe(540103n - 203248n);
    expect(r.total).toBe(r.forecast.forecastBalance);
  });

  describe("sens d'un virement : CJ sortant (budget négatif), Salaire entrant (CA3)", () => {
    const sc = (window: Tx[], budgets: Record<string, number>): Scenario => ({
      initial: 0,
      before: [],
      window,
      late: [],
      budgets,
    });

    it('CJ -2032,48 non parti : dans le budget restant, pas dans les revenus attendus ; égalité au centime', () => {
      const r = evaluate(sc([], { virement: -203248 }));
      expect(r.composition.budgetRemaining).toBe(-203248n);
      expect(r.composition.expectedIncome).toBe(0n);
      expect(r.forecast.forecastBalance).toBe(-203248n);
      expect(r.total).toBe(r.forecast.forecastBalance);
    });

    it('CJ parti en partie (-1000,00) : le reste dû (1032,48) est dans le budget restant', () => {
      const r = evaluate(
        sc([{ amount: -100000, categoryId: 'virement', reconciled: true }], {
          virement: -203248,
        }),
      );
      expect(r.composition.budgetRemaining).toBe(-103248n);
      expect(r.composition.expectedIncome).toBe(0n);
      expect(r.forecast.forecastBalance).toBe(-203248n);
      expect(r.total).toBe(r.forecast.forecastBalance);
    });

    it("Salaire +2033,00 arrivé, CJ non parti : égalité tenue, rien d'attendu côté revenus", () => {
      const r = evaluate(
        sc([{ amount: 203300, categoryId: 'salaire', reconciled: true }], {
          salaire: 203300,
          virement: -203248,
        }),
      );
      expect(r.composition.expectedIncome).toBe(0n);
      expect(r.composition.budgetRemaining).toBe(-203248n);
      expect(r.forecast.forecastBalance).toBe(52n);
      expect(r.total).toBe(r.forecast.forecastBalance);
    });
  });

  it('C1 : le budget restant est la somme des restes par catégorie', () => {
    const sc: Scenario = {
      initial: 0,
      before: [],
      window: [{ amount: -50000, categoryId: 'courses', reconciled: true }],
      late: [],
      budgets: { courses: 30000, loyer: 80000 },
    };
    const r = evaluate(sc);
    expect(r.composition.budgetRemaining).toBe(-80000n);
    expect(r.total).toBe(r.forecast.forecastBalance);
  });

  it('C2 : facture pending de revenu avant le début : reports positif, égalité tenue', () => {
    const sc: Scenario = {
      initial: 0,
      before: [{ amount: 20000, categoryId: 'salaire', pending: true }],
      window: [],
      late: [],
      budgets: {},
    };
    const r = evaluate(sc);
    expect(r.composition.reportsTotal).toBe(20000n);
    expect(r.total).toBe(r.forecast.forecastBalance);
  });

  it('C3 : aucune transaction, aucun budget : tout à 0 sauf la banque = prévu = départ', () => {
    const r = evaluate({
      initial: 12345,
      before: [],
      window: [],
      late: [],
      budgets: {},
    });
    expect(r.bank.realBankBalance).toBe(12345n);
    expect(r.forecast.forecastBalance).toBe(12345n);
    expect(r.total).toBe(12345n);
  });

  it('C4 : grille déterministe (états x signes x catégories) : somme des 7 lignes = prévu', () => {
    const states: Array<Pick<Tx, 'reconciled' | 'pending'>> = [
      { reconciled: true },
      {},
      { pending: true },
    ];
    const amounts = [-9000, -300, 0, 700, 25000];
    const cs: Array<string | null> = [
      'courses',
      'loyer',
      'salaire',
      'virement',
      null,
    ];
    const budgetSets: Array<Record<string, number>> = [
      {},
      { courses: 5000, loyer: -8000, salaire: 20000, prime: 3000 },
      { courses: 100, salaire: 100, virement: 30000 },
      { courses: 100, virement: -30000 },
    ];
    let n = 0;
    for (const st of states)
      for (const amount of amounts)
        for (const c of cs)
          for (const budgets of budgetSets) {
            // la même transaction avant le début, dans la fenêtre, et un tardif pointé
            const tx: Tx = { amount, categoryId: c, ...st };
            const r = evaluate({
              initial: 4200,
              before: [tx, { ...tx, amount: -amount }],
              window: [tx, { amount: -1234, categoryId: 'courses' }],
              late:
                amount > 0 ? [{ amount, categoryId: c, reconciled: true }] : [],
              budgets,
            });
            expect(r.total).toBe(r.forecast.forecastBalance);
            n++;
          }
    expect(n).toBe(3 * 5 * 5 * 4);
  });
});
