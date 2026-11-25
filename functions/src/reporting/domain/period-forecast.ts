import { CategoryType } from '../../categories/domain/category.entity';

/**
 * Règle du prévu de fin de période (docs/reporting.md, « Solde prévisionnel »),
 * écrite une seule fois : utilisée par les stats et par la simulation des budgets.
 * Fonction pure, centimes entiers (bigint).
 *
 *   forecast = départ + max(revenus réels, revenus prévus)
 *            - max(dépensé, |dépenses prévues|) + remboursement net
 *            + transactions sans catégorie (pending comprises, au réel)
 *
 *   dépensé = max(0, -dépenses réelles) ; remboursement net = max(0, dépenses réelles).
 */
export interface PeriodForecastInput {
  startBalance: bigint;
  categories: Array<{ id: string; type: CategoryType }>;
  /** Somme des transactions de la période par catégorie (tous types, pending comprises). */
  realByCategory: Map<string, bigint>;
  /** Somme des transactions sans catégorie. */
  uncategorized: bigint;
  /** Budgets de la période. Un budget à 0 vaut « pas de budget ». */
  budgets: Array<{ categoryId: string; amount: bigint }>;
}

export interface PeriodForecast {
  realIncome: bigint;
  plannedIncome: bigint;
  realExpenses: bigint;
  plannedExpenses: bigint;
  maxIncome: bigint;
  maxAbsExpenses: bigint;
  forecastBalance: bigint;
}

const ZERO = BigInt(0);
const abs = (n: bigint) => (n < ZERO ? -n : n);

/**
 * Règle des dépenses, écrite une seule fois (utilisée aussi par la composition du prévu).
 * Un réel net positif sur les catégories de dépense est un remboursement, pas une dépense.
 *
 * Réel net > 0 ET prévu > 0 : le budget entier reste à dépenser et le remboursement
 * s'ajoute (règle décidée par Lucas, option B).
 */
export function expenseRule(
  realExpenses: bigint,
  plannedExpenses: bigint,
): { spent: bigint; maxExpenses: bigint; refundSurplus: bigint } {
  const spent = realExpenses < ZERO ? -realExpenses : ZERO;
  const absPlanned = abs(plannedExpenses);
  const maxExpenses = spent > absPlanned ? spent : absPlanned;
  const refundSurplus = realExpenses > ZERO ? realExpenses : ZERO;
  return { spent, maxExpenses, refundSurplus };
}

export function computePeriodForecast(
  input: PeriodForecastInput,
): PeriodForecast {
  let realIncome = ZERO;
  let realExpenses = ZERO;
  let plannedIncome = ZERO;
  let plannedExpenses = ZERO;

  for (const cat of input.categories) {
    const catReal = input.realByCategory.get(cat.id) ?? ZERO;
    const budget = input.budgets.find((b) => b.categoryId === cat.id);
    // Signe du budget non imposé : toujours en valeur absolue.
    const catBudget = abs(budget?.amount ?? ZERO);

    const isIncome =
      cat.type === CategoryType.INCOME || cat.type === CategoryType.TRANSFER;

    if (isIncome) {
      realIncome += catReal;
      plannedIncome += catBudget;
    } else {
      realExpenses += catReal;
      plannedExpenses += catBudget;
    }
  }

  const { maxExpenses: maxAbsExpenses, refundSurplus } = expenseRule(
    realExpenses,
    plannedExpenses,
  );
  const maxIncome = realIncome > plannedIncome ? realIncome : plannedIncome;

  const forecastBalance =
    input.startBalance +
    maxIncome -
    maxAbsExpenses +
    refundSurplus +
    input.uncategorized;

  return {
    realIncome,
    plannedIncome,
    realExpenses,
    plannedExpenses,
    maxIncome,
    maxAbsExpenses,
    forecastBalance,
  };
}
