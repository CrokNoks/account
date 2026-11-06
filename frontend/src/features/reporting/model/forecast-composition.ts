import { ReportingStats } from './types';

export interface CompositionRow {
  key: 'bank' | 'card' | 'bills' | 'budget' | 'income' | 'forecast';
  /** Centimes, signé : une dépense est négative. */
  amount: number;
}

export interface CompositionSegment {
  key: 'forecast' | 'card' | 'bills' | 'budget';
  /** Centimes avant signe (positif). */
  amount: number;
}

export type CompositionView =
  | { mode: 'bar'; total: number; segments: CompositionSegment[] }
  | { mode: 'lines'; rows: CompositionRow[] };

/**
 * Affichage de la composition du prévu. Barre quand tout se lit comme une répartition du solde en
 * banque : CB et factures sont des sorties (≤ 0), aucun revenu attendu, banque et prévu ≥ 0 — la
 * condition porte sur les montants avant signe, un segment à 0 garde la barre. Sinon lignes signées.
 * Les montants viennent de « stats » : le prévu n'est jamais recalculé ici.
 */
export function compositionView(stats: ReportingStats): CompositionView {
  const bank = parseInt(stats.realBankBalance, 10);
  const card = parseInt(stats.cardTotal, 10);
  const bills = parseInt(stats.billsTotal, 10);
  const budget = parseInt(stats.budgetRemaining, 10);
  const income = parseInt(stats.expectedIncome, 10);
  const forecast = parseInt(stats.forecastBalance, 10);

  const asBar = bank >= 0 && forecast >= 0 && card <= 0 && bills <= 0 && budget <= 0 && income === 0;
  if (asBar) {
    return {
      mode: 'bar',
      total: bank,
      segments: [
        { key: 'forecast', amount: forecast },
        { key: 'card', amount: -card },
        { key: 'bills', amount: -bills },
        { key: 'budget', amount: -budget },
      ],
    };
  }
  return {
    mode: 'lines',
    rows: [
      { key: 'bank', amount: bank },
      { key: 'card', amount: card },
      { key: 'bills', amount: bills },
      { key: 'budget', amount: budget },
      { key: 'income', amount: income },
      { key: 'forecast', amount: forecast },
    ],
  };
}
