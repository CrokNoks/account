import { Period } from './period.entity';
import { BudgetInstance } from '../../budgets/domain/budget-instance.entity';
import { Transaction } from '../../transactions/domain/transaction.entity';

export abstract class PeriodRepository {
  abstract findById(id: string): Promise<Period | null>;
  abstract findLastByAccount(accountId: string): Promise<Period | null>;
  abstract findAllByAccount(accountId: string): Promise<Period[]>;
  abstract save(period: Period): Promise<void>;
  /**
   * Crée la période, ses budgets et les transactions issues des récurrentes dans
   * une seule transaction base de données, en désactivant les autres périodes
   * actives du compte : tout est écrit, ou rien. Lève `ConflictError` si deux
   * budgets visent la même catégorie.
   */
  abstract createWithBudgets(
    period: Period,
    budgets: BudgetInstance[],
    transactions: Transaction[],
  ): Promise<void>;
  abstract delete(id: string): Promise<void>;
}
