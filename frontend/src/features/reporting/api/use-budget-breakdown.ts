import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';

export interface BudgetCategoryBreakdown {
  categoryId: string;
  name: string;
  real: string;
  budget: string;
  remaining: string;
  percentage: number;
}

export interface BudgetBreakdownResponse {
  income: BudgetCategoryBreakdown[];
  expenses: BudgetCategoryBreakdown[];
  savings: BudgetCategoryBreakdown[];
  transfers: BudgetCategoryBreakdown[];
}

export function useBudgetBreakdown(accountId: string | null, periodId: string | null) {
  return useQuery<BudgetBreakdownResponse>({
    queryKey: ['reporting', 'budget-breakdown', accountId, periodId],
    queryFn: async () => {
      if (!accountId || !periodId) throw new Error('Missing accountId or periodId');
      const { data } = await apiClient.get(`/${accountId}/periods/${periodId}/reporting/budget-breakdown`);
      return data;
    },
    enabled: !!accountId && !!periodId,
  });
}
