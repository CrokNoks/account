import { BudgetInstance } from './budget-instance.entity';

export interface CategoryStats {
  categoryId: string;
  minReal: bigint;
  maxReal: bigint;
  avgReal: bigint;
}

export abstract class BudgetRepository {
  abstract findAllByPeriod(periodId: string): Promise<BudgetInstance[]>;
  abstract findById(id: string): Promise<BudgetInstance | null>;
  abstract save(instance: BudgetInstance): Promise<void>;
  abstract saveBulk(instances: BudgetInstance[]): Promise<void>;
  abstract delete(id: string): Promise<void>;
  abstract deleteAllByPeriod(periodId: string): Promise<void>;
  /**
   * Remplace tous les budgets d'une période (suppression puis insertion) dans une
   * seule transaction base de données : si l'insertion échoue, les anciens budgets
   * sont conservés. Lève `ConflictError` si deux budgets visent la même catégorie.
   */
  abstract replaceForPeriod(
    periodId: string,
    instances: BudgetInstance[],
  ): Promise<void>;

  /**
   * Calculates historical stats for each category of an account
   * based on previous transactions grouped by period.
   */
  abstract getHistoricalStatsByAccount(
    accountId: string,
  ): Promise<CategoryStats[]>;
}
