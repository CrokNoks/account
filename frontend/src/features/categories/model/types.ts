export enum CategoryType {
  EXPENSE = 'expense',
  INCOME = 'income',
  TRANSFER = 'transfer',
  SAVINGS = 'savings',
}

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  color: string;
  /** Catégorie « déclencheur de période » du compte (une seule, aucune par défaut). */
  isPeriodTrigger?: boolean;
}
