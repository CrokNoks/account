import { computeForecastComposition } from './forecast-composition';

const t = (
  amount: number,
  flags: { reconciled?: boolean; pending?: boolean },
) => ({
  amount: BigInt(amount),
  reconciled: flags.reconciled ?? false,
  pending: flags.pending ?? false,
});

const totals = (o: Partial<Record<string, number>> = {}) => ({
  realIncome: BigInt(o.realIncome ?? 0),
  plannedIncome: BigInt(o.plannedIncome ?? 0),
  realExpenses: BigInt(o.realExpenses ?? 0),
  plannedExpenses: BigInt(o.plannedExpenses ?? 0),
});

describe('computeForecastComposition', () => {
  it('cas nominal : CB, factures, budget restant, revenus attendus', () => {
    const r = computeForecastComposition({
      transactions: [
        t(200000, { reconciled: true }),
        t(-10000, { reconciled: true }),
        t(-5000, {}),
        t(-8000, { pending: true }),
      ],
      ...totals({
        realIncome: 200000,
        plannedIncome: 200000,
        realExpenses: -15000 - 8000,
        plannedExpenses: 30000,
      }),
    });
    expect(r.cardTotal).toBe(-5000n);
    expect(r.cardCount).toBe(1);
    expect(r.billsTotal).toBe(-8000n);
    expect(r.budgetRemaining).toBe(-7000n);
    expect(r.expectedIncome).toBe(0n);
  });

  it('revenus attendus : prévu au-dessus du réel', () => {
    const r = computeForecastComposition({
      transactions: [],
      ...totals({ realIncome: 200000, plannedIncome: 250000 }),
    });
    expect(r.expectedIncome).toBe(50000n);
  });

  it('revenus attendus jamais négatifs (réel au-dessus du prévu)', () => {
    const r = computeForecastComposition({
      transactions: [],
      ...totals({ realIncome: 300000, plannedIncome: 250000 }),
    });
    expect(r.expectedIncome).toBe(0n);
  });

  it('revenu net négatif : max(réel, prévu) = 0 donc attendu = 2000', () => {
    const r = computeForecastComposition({
      transactions: [],
      ...totals({ realIncome: -2000 }),
    });
    expect(r.expectedIncome).toBe(2000n);
  });

  it('le réel dépasse le budget : budget restant 0', () => {
    const r = computeForecastComposition({
      transactions: [],
      ...totals({ realExpenses: -23000, plannedExpenses: 20000 }),
    });
    expect(r.budgetRemaining).toBe(0n);
  });

  it('budget stocké en négatif : identique au positif', () => {
    const a = computeForecastComposition({
      transactions: [],
      ...totals({ plannedExpenses: -30000 }),
    });
    const b = computeForecastComposition({
      transactions: [],
      ...totals({ plannedExpenses: 30000 }),
    });
    expect(a.budgetRemaining).toBe(b.budgetRemaining);
    expect(a.budgetRemaining).toBe(-30000n);
  });

  it('dépenses nettes positives (remboursement) : tout le budget reste à dépenser', () => {
    const r = computeForecastComposition({
      transactions: [t(5000, { reconciled: true })],
      ...totals({ realExpenses: 5000, plannedExpenses: 3000 }),
    });
    expect(r.budgetRemaining).toBe(-3000n);
  });

  it('dépenses nettes positives sans budget : budget restant 0', () => {
    const r = computeForecastComposition({
      transactions: [t(10000, { reconciled: true })],
      ...totals({ realExpenses: 10000 }),
    });
    expect(r.budgetRemaining).toBe(0n);
  });

  it('pending rapprochée : ni CB ni facture', () => {
    const r = computeForecastComposition({
      transactions: [t(-8000, { pending: true, reconciled: true })],
      ...totals(),
    });
    expect(r.billsTotal).toBe(0n);
    expect(r.cardTotal).toBe(0n);
    expect(r.cardCount).toBe(0);
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

  it('CB positive (remboursement en CB) : total positif, compté', () => {
    const r = computeForecastComposition({
      transactions: [t(-5000, {}), t(9000, {})],
      ...totals(),
    });
    expect(r.cardTotal).toBe(4000n);
    expect(r.cardCount).toBe(2);
  });

  it('période vide : tout à zéro', () => {
    const r = computeForecastComposition({ transactions: [], ...totals() });
    expect(r).toEqual({
      cardTotal: 0n,
      cardCount: 0,
      billsTotal: 0n,
      budgetRemaining: 0n,
      expectedIncome: 0n,
    });
  });
});
