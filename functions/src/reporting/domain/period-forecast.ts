import { CategoryType } from '../../categories/domain/category.entity';

/**
 * Règle du prévu de fin de période (docs/reporting.md, « Solde prévisionnel »),
 * écrite une seule fois : utilisée par les stats, la composition et la simulation
 * des budgets. Fonction pure, centimes entiers (bigint).
 *
 * Le max se prend PAR CATÉGORIE, puis on additionne (un dépassement n'est plus
 * masqué par un budget non consommé ailleurs) :
 *
 *   forecast = départ + Σ revenus retenus - Σ dépenses retenues
 *            + Σ remboursements + transactions sans catégorie (pending comprises)
 *
 *   Dépenses et épargne (`expenseRule`) : dépensé = max(0, -réel),
 *     retenu = max(dépensé, |budget|), remboursement = max(0, réel).
 *   Revenus et virements (`incomeRule`) : réel >= 0 : retenu = max(réel, |budget|) ;
 *     revenu à réel < 0 : retenu = |budget| + réel (miroir du remboursement) ;
 *     virement à réel < 0 (sortant, déjà passé) : retenu = réel, budget ignoré.
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
  /** Σ des remboursements par catégorie de dépense (réel net positif). */
  refundSurplus: bigint;
  /** Σ -(retenu - dépensé) par catégorie de dépense : négatif ou nul. */
  budgetRemaining: bigint;
  /** Σ (retenu - réel) par catégorie de revenu : positif ou nul. */
  expectedIncome: bigint;
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

/**
 * Règle des revenus et virements d'UNE catégorie, écrite une seule fois.
 * Réel >= 0 : le plus grand de (réel, |budget|). Réel négatif (correction) : le budget
 * reste entier et le négatif se déduit. Exception, catégorie de type virement (`isTransfer`) :
 * un réel négatif est un virement sortant déjà passé, le budget est ignoré (retenu = réel, rien
 * d'attendu). `expected` = ce qui reste à recevoir sur la catégorie.
 */
export function incomeRule(
  realIncome: bigint,
  plannedIncome: bigint,
  isTransfer = false,
): { retained: bigint; expected: bigint } {
  const absPlanned = abs(plannedIncome);
  let retained: bigint;
  if (realIncome >= ZERO) {
    retained = realIncome > absPlanned ? realIncome : absPlanned;
  } else if (isTransfer) {
    retained = realIncome;
  } else {
    retained = absPlanned + realIncome;
  }
  return { retained, expected: retained - realIncome };
}

export function computePeriodForecast(
  input: PeriodForecastInput,
): PeriodForecast {
  let realIncome = ZERO;
  let realExpenses = ZERO;
  let plannedIncome = ZERO;
  let plannedExpenses = ZERO;
  let maxIncome = ZERO;
  let maxAbsExpenses = ZERO;
  let refundSurplus = ZERO;
  let budgetRemaining = ZERO;
  let expectedIncome = ZERO;

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
      const { retained, expected } = incomeRule(
        catReal,
        catBudget,
        cat.type === CategoryType.TRANSFER,
      );
      maxIncome += retained;
      expectedIncome += expected;
    } else {
      realExpenses += catReal;
      plannedExpenses += catBudget;
      const {
        spent,
        maxExpenses,
        refundSurplus: refund,
      } = expenseRule(catReal, catBudget);
      maxAbsExpenses += maxExpenses;
      refundSurplus += refund;
      budgetRemaining -= maxExpenses - spent;
    }
  }

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
    refundSurplus,
    budgetRemaining,
    expectedIncome,
    forecastBalance,
  };
}
