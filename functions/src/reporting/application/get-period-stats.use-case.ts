import { Injectable, Logger } from '@nestjs/common';
import { AccountRepository } from '../../accounts/domain/account.repository.interface';
import { PeriodRepository } from '../../periods/domain/period.repository.interface';
import { TransactionRepository } from '../../transactions/domain/transaction.repository.interface';
import { BudgetRepository } from '../../budgets/domain/budget.repository.interface';
import { CategoryRepository } from '../../categories/domain/category.repository.interface';
import {
  computeBankBalances,
  computeForecastComposition,
} from '../domain/forecast-composition';
import { computePeriodForecast } from '../domain/period-forecast';
import { loadPeriodForecastInput } from './load-period-forecast-input';

export interface PeriodStatsResponse {
  startBalance: string;
  realIncome: string;
  plannedIncome: string;
  realExpenses: string;
  plannedExpenses: string;
  /** Σ |budget| des dépenses et de l'épargne, sans les virements : base du rythme de dépense. */
  plannedExpensesExTransfers: string;
  realBankBalance: string;
  upcomingBalance: string;
  forecastBalance: string;
  /** Composition du prévu (écran Aujourd'hui), lignes signées en centimes. */
  cardTotal: string;
  cardCount: number;
  billsTotal: string;
  /** CB non pointées et factures `pending` datées avant le début (signé). */
  reportsTotal: string;
  /** -(revenus pointés après la fin d'une période active) : négatif ou nul. */
  budgetRemaining: string;
  expectedIncome: string;
  /**
   * Détail de `budgetRemaining` : catégories qui ont encore du budget à dépenser, reste positif en
   * centimes, trié par reste décroissant (puis nom, puis id). Σ remaining = -budgetRemaining.
   */
  budgetRemainingDetail: Array<{
    categoryId: string;
    name: string;
    remaining: string;
  }>;
}

@Injectable()
export class GetPeriodStatsUseCase {
  private readonly logger = new Logger(GetPeriodStatsUseCase.name);

  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly periodRepository: PeriodRepository,
    private readonly transactionRepository: TransactionRepository,
    private readonly budgetRepository: BudgetRepository,
    private readonly categoryRepository: CategoryRepository,
  ) {}

  async execute(
    accountId: string,
    periodId: string,
  ): Promise<PeriodStatsResponse> {
    const {
      categories,
      startBalance,
      startReconciled,
      startNonPending,
      reportsTotal,
      periodTransactions,
      realByCategory,
      uncategorized,
    } = await loadPeriodForecastInput(
      {
        accountRepository: this.accountRepository,
        periodRepository: this.periodRepository,
        transactionRepository: this.transactionRepository,
        categoryRepository: this.categoryRepository,
      },
      accountId,
      periodId,
    );
    const budgets = await this.budgetRepository.findAllByPeriod(periodId);

    const {
      realIncome,
      plannedIncome,
      realExpenses,
      plannedExpenses,
      plannedExpensesExTransfers,
      budgetRemaining,
      remainingByCategory,
      expectedIncome,
      forecastBalance,
      transferDirections,
    } = computePeriodForecast({
      startBalance,
      categories,
      realByCategory,
      uncategorized,
      budgets: budgets.map((b) => ({
        categoryId: b.categoryId,
        amount: b.amountAllocated,
      })),
    });

    // Sens d'un virement déduit du réel ou par défaut (pas du budget) : trace pour la mesure, sans montant.
    for (const d of transferDirections) {
      if (d.source === 'budget') continue;
      this.logger.debug({
        event: 'transfer_direction',
        categoryId: d.categoryId,
        direction: d.direction,
        source: d.source,
      });
    }

    const names = new Map(categories.map((c) => [c.id, c.name]));
    const detail = remainingByCategory
      .map((l) => ({
        categoryId: l.categoryId,
        name: names.get(l.categoryId) ?? '',
        remaining: l.remaining,
      }))
      .sort((a, b) =>
        a.remaining !== b.remaining
          ? a.remaining > b.remaining
            ? -1
            : 1
          : a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) ||
            a.categoryId.localeCompare(b.categoryId),
      );
    // Garde-fou d'exploitation (ne devrait jamais arriver) : sans montant ni nom.
    const detailSum = detail.reduce((sum, l) => sum + l.remaining, BigInt(0));
    if (detailSum !== -budgetRemaining) {
      this.logger.warn({ event: 'budget_remaining_detail_mismatch', periodId });
    }

    // En banque : départ pointé + pointées de la fenêtre.
    // À venir : départ non pending + non pending de la fenêtre.
    const { realBankBalance, upcomingBalance } = computeBankBalances({
      startReconciled,
      startNonPending,
      transactions: periodTransactions,
    });

    const composition = computeForecastComposition({
      transactions: periodTransactions,
      reportsTotal,
      budgetRemaining,
      expectedIncome,
    });

    return {
      startBalance: startBalance.toString(),
      realIncome: realIncome.toString(),
      plannedIncome: plannedIncome.toString(),
      realExpenses: realExpenses.toString(),
      plannedExpenses: plannedExpenses.toString(),
      plannedExpensesExTransfers: plannedExpensesExTransfers.toString(),
      realBankBalance: realBankBalance.toString(),
      upcomingBalance: upcomingBalance.toString(),
      forecastBalance: forecastBalance.toString(),
      cardTotal: composition.cardTotal.toString(),
      cardCount: composition.cardCount,
      billsTotal: composition.billsTotal.toString(),
      reportsTotal: composition.reportsTotal.toString(),
      budgetRemaining: composition.budgetRemaining.toString(),
      expectedIncome: composition.expectedIncome.toString(),
      budgetRemainingDetail: detail.map((l) => ({
        ...l,
        remaining: l.remaining.toString(),
      })),
    };
  }
}
