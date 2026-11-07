import { CategoryType } from '../../categories/domain/category.entity';

/**
 * Règle du prévu de fin de période (docs/reporting.md, « Solde prévisionnel »),
 * écrite une seule fois : utilisée par les stats et par la simulation des budgets.
 * Fonction pure, centimes entiers (bigint).
 *
 *   forecast = départ + max(revenus réels, revenus prévus)
 *            - max(|dépenses réelles|, |dépenses prévues|)
 *            + transactions sans catégorie (pending comprises, au réel)
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

  const absRealExpenses = abs(realExpenses);
  const absPlannedExpenses = abs(plannedExpenses);

  const maxIncome = realIncome > plannedIncome ? realIncome : plannedIncome;
  const maxAbsExpenses =
    absRealExpenses > absPlannedExpenses ? absRealExpenses : absPlannedExpenses;

  const forecastBalance =
    input.startBalance + maxIncome - maxAbsExpenses + input.uncategorized;

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
