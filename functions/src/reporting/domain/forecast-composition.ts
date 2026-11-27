/**
 * Composition du prévu (écran Aujourd'hui). Fonction pure, centimes entiers.
 *
 * Le prévu (`forecastBalance`) est calculé par `computePeriodForecast` ; les lignes
 * « budget restant » et « revenus attendus » viennent de ce même calcul (sommes par
 * catégorie, une seule règle). Un virement sortant (budget négatif) compte dans le budget
 * restant comme une dépense, un virement entrant dans les revenus attendus. Égalité au centime, testée :
 *   banque + CB + factures + reports + budget restant + revenus attendus = prévu
 *
 * Pourquoi elle tient : banque = départ pointé + pointées de la fenêtre ;
 * CB + factures = non pointées de la fenêtre ; reports = départ complet - départ pointé.
 * La somme vaut donc départ complet + total de la fenêtre, et le prévu = départ complet
 * + total de la fenêtre + attendu - reste (par catégorie). Une seule fenêtre pour les
 * deux sommes : un revenu pointé daté après la fin d'une période active est dans les deux.
 */

export interface CompositionTransaction {
  amount: bigint;
  reconciled: boolean;
  pending: boolean;
}

export interface CompositionInput {
  /** Transactions de la fenêtre de la période. */
  transactions: CompositionTransaction[];
  /** Départ complet - départ pointé : CB non pointées et factures `pending` avant le début (signé). */
  reportsTotal: bigint;
  /** `budgetRemaining` de `computePeriodForecast` : négatif ou nul. */
  budgetRemaining: bigint;
  /** `expectedIncome` de `computePeriodForecast` : positif ou nul. */
  expectedIncome: bigint;
}

export interface ForecastComposition {
  /** Transactions non rapprochées et non `pending` : signées. */
  cardTotal: bigint;
  cardCount: number;
  /** `pending` non rapprochées : signées. */
  billsTotal: bigint;
  /** CB non pointées et factures `pending` datées avant le début de la période : signé. */
  reportsTotal: bigint;
  budgetRemaining: bigint;
  expectedIncome: bigint;
}

export function computeForecastComposition(
  input: CompositionInput,
): ForecastComposition {
  let cardTotal = 0n;
  let cardCount = 0;
  let billsTotal = 0n;
  for (const t of input.transactions) {
    if (t.reconciled) continue; // déjà dans le solde en banque
    if (t.pending) {
      billsTotal += t.amount;
    } else {
      cardTotal += t.amount;
      cardCount += 1;
    }
  }

  return {
    cardTotal,
    cardCount,
    billsTotal,
    reportsTotal: input.reportsTotal,
    budgetRemaining: input.budgetRemaining,
    expectedIncome: input.expectedIncome,
  };
}

export interface BankBalancesInput {
  /** Solde initial + pointées datées avant le début. */
  startReconciled: bigint;
  /** Solde initial + non `pending` datées avant le début. */
  startNonPending: bigint;
  /** Transactions de la fenêtre de la période. */
  transactions: CompositionTransaction[];
}

/**
 * « En banque » (pointées seules) et « À venir » (non `pending`), chacun avec son départ.
 */
export function computeBankBalances(input: BankBalancesInput): {
  realBankBalance: bigint;
  upcomingBalance: bigint;
} {
  let reconciled = 0n;
  let nonPending = 0n;
  for (const t of input.transactions) {
    if (t.reconciled) reconciled += t.amount;
    if (!t.pending) nonPending += t.amount;
  }
  return {
    realBankBalance: input.startReconciled + reconciled,
    upcomingBalance: input.startNonPending + nonPending,
  };
}
