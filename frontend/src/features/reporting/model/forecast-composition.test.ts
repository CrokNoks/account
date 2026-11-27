import { describe, expect, it } from 'vitest';
import { compositionView } from './forecast-composition';
import { ReportingStats } from './types';

const stats = (over: Partial<ReportingStats> = {}): ReportingStats => ({
  startBalance: '100000',
  realIncome: '200000',
  plannedIncome: '200000',
  realExpenses: '-23000',
  plannedExpenses: '30000',
  realBankBalance: '290000',
  upcomingBalance: '285000',
  forecastBalance: '270000',
  cardTotal: '-5000',
  cardCount: 1,
  billsTotal: '-8000',
  reportsTotal: '0',
  budgetRemaining: '-7000',
  expectedIncome: '0',
  ...over,
});

describe('compositionView', () => {
  it('barre quand CB et factures sont des sorties et que rien n\'est attendu en revenus', () => {
    const view = compositionView(stats());
    expect(view.mode).toBe('bar');
    if (view.mode === 'bar') {
      // Montants avant signe, la barre représente le solde en banque
      expect(view.total).toBe(BigInt(290000));
      expect(view.segments.map((s) => [s.key, s.amount])).toEqual([
        ['forecast', BigInt(270000)],
        ['card', BigInt(5000)],
        ['bills', BigInt(8000)],
        ['budget', BigInt(7000)],
      ]);
    }
  });

  it('un segment à 0 garde la barre', () => {
    expect(compositionView(stats({ cardTotal: '0', cardCount: 0 })).mode).toBe('bar');
    expect(compositionView(stats({ billsTotal: '0' })).mode).toBe('bar');
    expect(compositionView(stats({ budgetRemaining: '0', forecastBalance: '277000' })).mode).toBe('bar');
  });

  it.each([
    ['revenus attendus > 0', { expectedIncome: '50000', forecastBalance: '320000' }],
    ['remboursement en CB (CB positive)', { cardTotal: '4000', forecastBalance: '270000' }],
    ['facture positive', { billsTotal: '1000' }],
    ['reports positifs (facture de revenu avant le début)', { reportsTotal: '20000', forecastBalance: '290000' }],
    ['prévu négatif', { forecastBalance: '-1000' }],
    ['solde en banque négatif', { realBankBalance: '-1000' }],
  ])('lignes signées : %s', (_name, over) => {
    const view = compositionView(stats(over));
    expect(view.mode).toBe('lines');
    if (view.mode === 'lines') {
      expect(view.rows.map((r) => r.key).filter((k) => k !== 'reports')).toEqual(['bank', 'card', 'bills', 'budget', 'income', 'forecast']);
    }
  });

  it('les lignes gardent leur signe', () => {
    const view = compositionView(stats({ expectedIncome: '50000', forecastBalance: '320000' }));
    if (view.mode === 'lines') {
      expect(view.rows.map((r) => r.amount)).toEqual([290000, -5000, -8000, -7000, 50000, 320000].map(BigInt));
    }
  });

  it('UI2 : reports < 0 : la barre gagne un segment, le total reste la banque', () => {
    // 320000 - 5000 - 8000 - 15000 - 7000 = 285000
    const view = compositionView(stats({ realBankBalance: '320000', reportsTotal: '-15000', forecastBalance: '285000' }));
    expect(view.mode).toBe('bar');
    if (view.mode === 'bar') {
      expect(view.total).toBe(BigInt(320000));
      expect(view.segments.map((s) => [s.key, s.amount])).toEqual([
        ['forecast', BigInt(285000)],
        ['card', BigInt(5000)],
        ['bills', BigInt(8000)],
        ['reports', BigInt(15000)],
        ['budget', BigInt(7000)],
      ]);
      expect(view.segments.reduce((n, s) => n + s.amount, BigInt(0))).toBe(view.total);
    }
  });

  it('UI1 : reports à 0 : pas de segment en plus', () => {
    const view = compositionView(stats());
    if (view.mode === 'bar') expect(view.segments.map((s) => s.key)).toEqual(['forecast', 'card', 'bills', 'budget']);
  });

  it('UI3 : en lignes, reports est masqué à 0, signé sinon, dans l\'ordre de la composition', () => {
    const none = compositionView(stats({ expectedIncome: '50000', forecastBalance: '320000' }));
    if (none.mode === 'lines') expect(none.rows.map((r) => r.key)).toEqual(['bank', 'card', 'bills', 'budget', 'income', 'forecast']);
    const both = compositionView(stats({ reportsTotal: '20000', expectedIncome: '30000', forecastBalance: '335000' }));
    expect(both.mode).toBe('lines');
    if (both.mode === 'lines') {
      expect(both.rows.map((r) => [r.key, r.amount])).toEqual([
        ['bank', BigInt(290000)],
        ['card', BigInt(-5000)],
        ['bills', BigInt(-8000)],
        ['reports', BigInt(20000)],
        ['budget', BigInt(-7000)],
        ['income', BigInt(30000)],
        ['forecast', BigInt(335000)],
      ]);
    }
  });

  it('réponse d\'un back plus ancien (sans reportsTotal) ou encore avec arrivedAfterEnd : ignoré, jamais d\'erreur', () => {
    const old = { ...stats(), arrivedAfterEnd: '-30000' } as Partial<ReportingStats>;
    delete old.reportsTotal;
    const bar = compositionView(old as ReportingStats);
    expect(bar.mode).toBe('bar');
    if (bar.mode === 'bar') expect(bar.segments.map((s) => s.key)).toEqual(['forecast', 'card', 'bills', 'budget']);
    const lines = compositionView({ ...old, expectedIncome: '50000', forecastBalance: '320000' } as ReportingStats);
    expect(lines.mode).toBe('lines');
    if (lines.mode === 'lines') expect(lines.rows.map((r) => r.key)).toEqual(['bank', 'card', 'bills', 'budget', 'income', 'forecast']);
  });

  it('reste exact au-delà de 2^53', () => {
    const view = compositionView(stats({ realBankBalance: '9007199254740995', forecastBalance: '9007199254740991', cardTotal: '-1', billsTotal: '-1', budgetRemaining: '-2' }));
    expect(view.mode).toBe('bar');
    if (view.mode === 'bar') {
      expect(view.total).toBe(BigInt('9007199254740995'));
      expect(view.segments.map((s) => s.amount)).toEqual([BigInt('9007199254740991'), BigInt(1), BigInt(1), BigInt(2)]);
    }
  });
});
