import { CategoryType } from '../../categories/domain/category.entity';
import {
  transferDirection,
  transferDirectionSource,
  type TransferDirection,
} from './transfer-direction';

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
 *   Revenus et virements entrants (`incomeRule`) : réel >= 0 : retenu = max(réel, |budget|) ;
 *     revenu à réel < 0 : retenu = |budget| + réel (miroir du remboursement) ;
 *     virement entrant à réel < 0 : retenu = réel, budget ignoré.
 *   Virements sortants (sens : `transferDirection`, budget négatif ou, sans budget, réel négatif) :
 *     `expenseRule`, comme une dépense. Un virement sortant non parti baisse le prévu et ne le relève jamais.
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
  /** Σ |budget| des revenus et des virements entrants. */
  plannedIncome: bigint;
  realExpenses: bigint;
  /** Σ |budget| des dépenses, de l'épargne et des virements sortants. */
  plannedExpenses: bigint;
  /** Σ |budget| des seules dépenses et épargne : base du rythme de dépense (hors virements). */
  plannedExpensesExTransfers: bigint;
  maxIncome: bigint;
  maxAbsExpenses: bigint;
  /** Σ des remboursements par catégorie de dépense ou de virement sortant (réel net positif). */
  refundSurplus: bigint;
  /** Σ -(retenu - dépensé) par catégorie de dépense ou de virement sortant : négatif ou nul. */
  budgetRemaining: bigint;
  /**
   * Détail de `budgetRemaining` : reste (> 0) de chaque catégorie de dépense, d'épargne ou de
   * virement sortant. Invariant : Σ remaining = -budgetRemaining. Non trié (le tri est à l'appelant).
   */
  remainingByCategory: Array<{ categoryId: string; remaining: bigint }>;
  /** Σ (retenu - réel) par catégorie de revenu ou de virement entrant : positif ou nul. */
  expectedIncome: bigint;
  forecastBalance: bigint;
  /** Sens retenu pour chaque catégorie de virement et son origine (pour les logs). */
  transferDirections: Array<{
    categoryId: string;
    direction: TransferDirection;
    source: 'budget' | 'real' | 'default';
  }>;
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
  let plannedExpensesExTransfers = ZERO;
  let maxIncome = ZERO;
  let maxAbsExpenses = ZERO;
  let refundSurplus = ZERO;
  let budgetRemaining = ZERO;
  let expectedIncome = ZERO;
  const remainingByCategory: PeriodForecast['remainingByCategory'] = [];
  const transferDirections: PeriodForecast['transferDirections'] = [];

  for (const cat of input.categories) {
    const catReal = input.realByCategory.get(cat.id) ?? ZERO;
    const budget = input.budgets.find((b) => b.categoryId === cat.id);
    const signedBudget = budget?.amount ?? ZERO;
    // Le montant de calcul est toujours la valeur absolue ; seul le sens d'un virement lit le signe.
    const catBudget = abs(signedBudget);
    const isTransfer = cat.type === CategoryType.TRANSFER;
    const isIncome = cat.type === CategoryType.INCOME;

    // Un virement sortant se calcule comme une dépense, un virement entrant comme un revenu.
    const direction = isTransfer
      ? transferDirection(signedBudget, catReal)
      : null;
    const outgoing = direction === 'outgoing';
    if (direction) {
      transferDirections.push({
        categoryId: cat.id,
        direction,
        source: transferDirectionSource(signedBudget, catReal),
      });
    }

    if (isIncome || (isTransfer && !outgoing)) {
      realIncome += catReal;
      plannedIncome += catBudget;
      const { retained, expected } = incomeRule(catReal, catBudget, isTransfer);
      maxIncome += retained;
      expectedIncome += expected;
    } else if (outgoing) {
      // Les totaux bruts gardent les virements côté revenus (aucun écran ne les lit).
      realIncome += catReal;
      plannedExpenses += catBudget;
      const {
        spent,
        maxExpenses,
        refundSurplus: refund,
      } = expenseRule(catReal, catBudget);
      maxAbsExpenses += maxExpenses;
      refundSurplus += refund;
      const left = maxExpenses - spent;
      budgetRemaining -= left;
      if (left > ZERO) {
        remainingByCategory.push({ categoryId: cat.id, remaining: left });
      }
    } else {
      realExpenses += catReal;
      plannedExpenses += catBudget;
      plannedExpensesExTransfers += catBudget;
      const {
        spent,
        maxExpenses,
        refundSurplus: refund,
      } = expenseRule(catReal, catBudget);
      maxAbsExpenses += maxExpenses;
      refundSurplus += refund;
      const left = maxExpenses - spent;
      budgetRemaining -= left;
      if (left > ZERO) {
        remainingByCategory.push({ categoryId: cat.id, remaining: left });
      }
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
    plannedExpensesExTransfers,
    maxIncome,
    maxAbsExpenses,
    refundSurplus,
    budgetRemaining,
    remainingByCategory,
    expectedIncome,
    forecastBalance,
    transferDirections,
  };
}
