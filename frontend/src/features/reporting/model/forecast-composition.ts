import { ReportingStats } from './types';

export interface CompositionRow {
  key: 'bank' | 'card' | 'bills' | 'reports' | 'budget' | 'income' | 'forecast';
  /** Centimes, signé : une dépense est négative. */
  amount: bigint;
}

export interface CompositionSegment {
  key: 'forecast' | 'card' | 'bills' | 'reports' | 'budget';
  /** Centimes avant signe (positif). */
  amount: bigint;
}

export type CompositionView =
  | { mode: 'bar'; total: bigint; segments: CompositionSegment[] }
  | { mode: 'lines'; rows: CompositionRow[] };

/**
 * Affichage de la composition du prévu (6 termes : banque, CB, factures, reports, budget restant, revenus attendus). Barre quand tout se lit comme une répartition du solde en
 * banque : CB, factures et reports sont des sorties (≤ 0), aucun revenu attendu,
 * banque et prévu ≥ 0 — la condition porte sur les montants avant signe, un segment à 0 garde la barre.
 * Reports ne figure (barre ou lignes) que s'il n'est pas nul. Sinon lignes signées.
 * Les montants viennent de « stats » : le prévu n'est jamais recalculé ici.
 */
export function compositionView(stats: ReportingStats): CompositionView {
  const bank = BigInt(stats.realBankBalance);
  const card = BigInt(stats.cardTotal);
  const bills = BigInt(stats.billsTotal);
  const reports = BigInt(stats.reportsTotal ?? '0');
  const budget = BigInt(stats.budgetRemaining);
  const income = BigInt(stats.expectedIncome);
  const forecast = BigInt(stats.forecastBalance);
  const zero = BigInt(0);

  const asBar = bank >= zero && forecast >= zero && card <= zero && bills <= zero && reports <= zero && budget <= zero && income === zero;
  if (asBar) {
    return {
      mode: 'bar',
      total: bank,
      segments: [
        { key: 'forecast', amount: forecast },
        { key: 'card', amount: -card },
        { key: 'bills', amount: -bills },
        ...(reports !== zero ? [{ key: 'reports' as const, amount: -reports }] : []),
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
      ...(reports !== zero ? [{ key: 'reports' as const, amount: reports }] : []),
      { key: 'budget', amount: budget },
      { key: 'income', amount: income },
      { key: 'forecast', amount: forecast },
    ],
  };
}
