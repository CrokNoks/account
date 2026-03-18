export interface Period {
  id: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
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
