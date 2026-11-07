import { BudgetInstance } from './budget-instance.entity';

export interface CategoryStats {
  categoryId: string;
  minReal: bigint;
  maxReal: bigint;
  avgReal: bigint;
}

export interface BudgetTemplate {
  categoryId: string;
  amount: bigint;
}

/** Budget tel que l'appelant l'a lu : sert à détecter un changement concurrent. */
export interface ExpectedBudget {
  categoryId: string;
  amountAllocated: bigint;
}

export abstract class BudgetRepository {
  abstract findAllByPeriod(periodId: string): Promise<BudgetInstance[]>;
  abstract findById(id: string): Promise<BudgetInstance | null>;
  abstract save(instance: BudgetInstance): Promise<void>;
  abstract delete(id: string): Promise<void>;
  /**
   * Remplace tous les budgets d'une période (suppression puis insertion) dans une
   * seule transaction base de données : si l'insertion échoue, les anciens budgets
   * sont conservés. Lève `ConflictError` si deux budgets visent la même catégorie.
   *
   * `expected` (facultatif) : les budgets tels que l'appelant les a lus. Vérifié dans la
   * même transaction, sous verrou : s'ils ne sont plus ceux de la base (montants à 0
   * ignorés des deux côtés), lève `BudgetsChangedError` et rien n'est écrit. `[]` est une
   * valeur (« aucun budget vu ») ; absent = pas de contrôle.
   */
  abstract replaceForPeriod(
    periodId: string,
    instances: BudgetInstance[],
    expected?: ExpectedBudget[],
  ): Promise<void>;

  /**
   * Calculates historical stats for each category of an account
   * based on previous transactions grouped by period.
   */
  abstract getHistoricalStatsByAccount(
    accountId: string,
  ): Promise<CategoryStats[]>;

  /** Montants fixes configurés pour le compte (une ligne par catégorie configurée). */
  abstract findTemplatesByAccount(accountId: string): Promise<BudgetTemplate[]>;

  /**
   * Enregistre les montants fixes du compte en un seul `upsert` (un seul ordre SQL :
   * tout ou rien) sur (compte, catégorie).
   */
  abstract saveTemplates(
    accountId: string,
    items: BudgetTemplate[],
  ): Promise<void>;
}
