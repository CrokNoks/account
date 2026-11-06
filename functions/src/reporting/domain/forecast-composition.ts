/**
 * Composition du prévu (écran Aujourd'hui). Fonction pure, centimes entiers.
 *
 * Le prévu (`forecastBalance`) reste calculé par `get-period-stats` ; ces
 * lignes sont calculées à côté, indépendamment, et un test vérifie que
 *   banque + CB + factures + budget restant + revenus attendus = prévu.
 */

export interface CompositionTransaction {
  amount: bigint;
  reconciled: boolean;
  pending: boolean;
}

export interface CompositionInput {
  transactions: CompositionTransaction[];
  /** Totaux par type de catégorie (déjà calculés par get-period-stats). */
  realIncome: bigint;
  plannedIncome: bigint;
  realExpenses: bigint;
  plannedExpenses: bigint;
}

export interface ForecastComposition {
  /** Transactions non rapprochées et non `pending` : signées. */
  cardTotal: bigint;
  cardCount: number;
  /** `pending` non rapprochées : signées. */
  billsTotal: bigint;
  /** -(max(|réel|, |prévu|) + dépenses réelles signées) : négatif ou nul. */
  budgetRemaining: bigint;
  /** max(réel, prévu) - réel : positif ou nul. */
  expectedIncome: bigint;
}

const abs = (n: bigint): bigint => (n < 0n ? -n : n);

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

  const absReal = abs(input.realExpenses);
  const absPlanned = abs(input.plannedExpenses);
  const maxAbsExpenses = absReal > absPlanned ? absReal : absPlanned;
  const budgetRemaining = -(maxAbsExpenses + input.realExpenses);

  const plannedIncome = abs(input.plannedIncome);
  const maxIncome =
    input.realIncome > plannedIncome ? input.realIncome : plannedIncome;
  const expectedIncome = maxIncome - input.realIncome;

  return { cardTotal, cardCount, billsTotal, budgetRemaining, expectedIncome };
}
