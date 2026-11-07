import { Injectable } from '@nestjs/common';
import { AccountRepository } from '../../accounts/domain/account.repository.interface';
import { PeriodRepository } from '../../periods/domain/period.repository.interface';
import { TransactionRepository } from '../../transactions/domain/transaction.repository.interface';
import { BudgetRepository } from '../../budgets/domain/budget.repository.interface';
import { CategoryRepository } from '../../categories/domain/category.repository.interface';
import { AccountReferencesService } from '../../shared/application/account-references.service';
import { DomainValidationError } from '../../shared/domain/errors';
import { computePeriodForecast } from '../domain/period-forecast';
import { loadPeriodForecastInput } from './load-period-forecast-input';

export interface SimulatePeriodForecastCommand {
  accountId: string;
  periodId: string;
  /** Liste complète des budgets saisis : une catégorie absente = sans budget. */
  budgets: Array<{ categoryId: string; amount: bigint }>;
}

/** Centimes en texte. */
export interface PeriodForecastSimulationResponse {
  forecastBalance: string;
  /** Prévu avec les budgets enregistrés (= `forecastBalance` des stats). */
  savedForecastBalance: string;
  delta: string;
  incomeEffect: string;
  expensesEffect: string;
  plannedIncome: string;
  plannedExpenses: string;
  realIncome: string;
  realExpenses: string;
}

/**
 * Prévu de fin de période que donneraient les stats si ces budgets étaient enregistrés.
 * Lecture seule : aucun appel d'écriture, seuls les dépôts nécessaires à la lecture sont injectés.
 */
@Injectable()
export class SimulatePeriodForecastUseCase {
  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly periodRepository: PeriodRepository,
    private readonly transactionRepository: TransactionRepository,
    private readonly budgetRepository: BudgetRepository,
    private readonly categoryRepository: CategoryRepository,
    private readonly references: AccountReferencesService,
  ) {}

  async execute(
    command: SimulatePeriodForecastCommand,
  ): Promise<PeriodForecastSimulationResponse> {
    const { accountId, periodId } = command;
    const input = await loadPeriodForecastInput(
      {
        accountRepository: this.accountRepository,
        periodRepository: this.periodRepository,
        transactionRepository: this.transactionRepository,
        categoryRepository: this.categoryRepository,
      },
      accountId,
      periodId,
    );

    const ids = command.budgets.map((b) => b.categoryId);
    if (new Set(ids).size !== ids.length)
      throw new DomainValidationError('Duplicated category in budgets');
    await this.references.ensureCategories(accountId, ids);

    const savedBudgets = (
      await this.budgetRepository.findAllByPeriod(periodId)
    ).map((b) => ({ categoryId: b.categoryId, amount: b.amountAllocated }));

    const base = {
      startBalance: input.startBalance,
      categories: input.categories,
      realByCategory: input.realByCategory,
      uncategorized: input.uncategorized,
    };
    const simulated = computePeriodForecast({
      ...base,
      budgets: command.budgets,
    });
    const saved = computePeriodForecast({ ...base, budgets: savedBudgets });

    const incomeEffect = simulated.maxIncome - saved.maxIncome;
    const expensesEffect = -(simulated.maxAbsExpenses - saved.maxAbsExpenses);

    return {
      forecastBalance: simulated.forecastBalance.toString(),
      savedForecastBalance: saved.forecastBalance.toString(),
      delta: (simulated.forecastBalance - saved.forecastBalance).toString(),
      incomeEffect: incomeEffect.toString(),
      expensesEffect: expensesEffect.toString(),
      plannedIncome: simulated.plannedIncome.toString(),
      plannedExpenses: simulated.plannedExpenses.toString(),
      realIncome: simulated.realIncome.toString(),
      realExpenses: simulated.realExpenses.toString(),
    };
  }
}
