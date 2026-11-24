import { AccountRepository } from '../../accounts/domain/account.repository.interface';
import { PeriodRepository } from '../../periods/domain/period.repository.interface';
import { TransactionRepository } from '../../transactions/domain/transaction.repository.interface';
import { CategoryRepository } from '../../categories/domain/category.repository.interface';
import { Category } from '../../categories/domain/category.entity';
import { Transaction } from '../../transactions/domain/transaction.entity';
import { NotFoundError } from '../../shared/domain/errors';
import { filterPeriodWindow, periodLoadEndDate } from '../domain/period-window';

export interface PeriodForecastSources {
  accountRepository: AccountRepository;
  periodRepository: PeriodRepository;
  transactionRepository: TransactionRepository;
  categoryRepository: CategoryRepository;
}

export interface LoadedPeriodForecastInput {
  categories: Category[];
  startBalance: bigint;
  periodTransactions: Transaction[];
  /** Réel par catégorie (tous types, pending comprises). */
  realByCategory: Map<string, bigint>;
  /** Somme des transactions sans catégorie (pas de budget possible). */
  uncategorized: bigint;
}

/**
 * Charge ce qui sert au prévu d'une période, partagé par les stats et la simulation
 * pour que le réel ne soit calculé qu'à un seul endroit. Les budgets ne sont pas lus ici.
 * Lève `NotFoundError` si le compte ou la période n'existe pas pour l'appelant.
 */
export async function loadPeriodForecastInput(
  sources: PeriodForecastSources,
  accountId: string,
  periodId: string,
): Promise<LoadedPeriodForecastInput> {
  const account = await sources.accountRepository.findById(accountId);
  const period = await sources.periodRepository.findById(periodId);
  if (!account || !period || period.accountId !== accountId)
    throw new NotFoundError('Account or Period not found');

  const categories =
    await sources.categoryRepository.findAllByAccount(accountId);

  // Solde de départ : solde initial + transactions avant la période (calculé en base)
  const sumBeforeStart =
    await sources.transactionRepository.sumAmountByAccountBeforeDate(
      accountId,
      period.startDate,
    );
  const startBalance = account.initialBalance + sumBeforeStart;

  // Fenêtre unique (domain/period-window) : période active = pas de borne haute
  // au chargement, le revenu tardif est écarté par le filtre.
  const periodTransactions = filterPeriodWindow(
    await sources.transactionRepository.findAllByAccountUnpaginated(accountId, {
      startDate: period.startDate,
      endDate: periodLoadEndDate(period),
    }),
    period,
  );

  const realByCategory = new Map<string, bigint>();
  let uncategorized = BigInt(0);
  for (const t of periodTransactions) {
    if (t.categoryId) {
      const current = realByCategory.get(t.categoryId) || BigInt(0);
      realByCategory.set(t.categoryId, current + t.amount);
    } else {
      uncategorized += t.amount;
    }
  }

  return {
    categories,
    startBalance,
    periodTransactions,
    realByCategory,
    uncategorized,
  };
}
