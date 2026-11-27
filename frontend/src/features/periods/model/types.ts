export interface Period {
  id: string;
  startDate: string;
  /** `null` pour une période ouverte. */
  endDate: string | null;
  /** Fin estimée, utilisée quand `endDate` est vide. */
  estimatedEndDate?: string | null;
  isActive: boolean;
}

/** Ce que la suppression d'une période ferait (aperçu : nombres et dates, aucun montant). */
export interface PeriodDeletionPreview {
  removedPending: number;
  keptTransactions: number;
  /** Période rouverte (annulation de bascule), sinon null. */
  reopen: { periodId: string; startDate: string; endDate: string | null } | null;
  origin: 'manual' | 'trigger';
}

export interface PeriodBudget {
  id: string;
  periodId: string;
  categoryId: string;
  amountAllocated: string;
  categoryName?: string;
  categoryColor?: string;
}

export interface BudgetInstance {
  id: string;
  categoryId: string;
  amountAllocated: string;
}

export interface PeriodDraft {
  suggestedStartDate: string;
  suggestedEndDate: string;
  categoriesWithStats: Array<{
    categoryId: string;
    name: string;
    type: string;
    defaultAllocated: string;
    minReal: string;
    maxReal: string;
    avgReal: string;
    /** Virements seulement : sens calculé par le back. */
    direction?: 'outgoing' | 'incoming';
  }>;
}

export interface CreatePeriodCommand {
  accountId: string;
  startDate: string;
  endDate: string;
  budgets: Array<{
    categoryId: string;
    amountAllocated: string;
  }>;
  injectRecurring?: boolean;
}

export interface UpdateBudgetsDto {
  budgets: Array<{
    categoryId: string;
    amountAllocated: string;
  }>;
  /** Budgets tels que lus par l'écran : l'API refuse (409 BUDGETS_CHANGED) s'ils ont changé depuis. */
  expectedBudgets?: Array<{
    categoryId: string;
    amountAllocated: string;
  }>;
}

export interface DeletePeriodData {
  accountId: string;
  id: string;
}

export interface UpdatePeriodBudgetsData {
  accountId: string;
  periodId: string;
  data: UpdateBudgetsDto;
}

export interface UpdatePeriodData {
  accountId: string;
  id: string;
  data: Partial<Period>;
}

/** Une ligne de l'écran des montants par défaut : montant configuré, ou proposition (non enregistrée). */
export interface BudgetTemplateLine {
  categoryId: string;
  name: string;
  amount: string;
  isProposal: boolean;
  /** Virements seulement : sens calculé par le back. */
  direction?: 'outgoing' | 'incoming';
}

export interface SaveBudgetTemplatesData {
  accountId: string;
  items: Array<{ categoryId: string; amount: string }>;
}
