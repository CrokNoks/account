import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';

export interface BudgetInstance {
  id: string;
  categoryId: string;
  amountAllocated: string;
}

export function usePeriodBudgets(accountId: string | null, periodId: string | null) {
  return useQuery<BudgetInstance[]>({
    queryKey: ['periods', periodId, 'budgets'],
    queryFn: async () => {
      if (!accountId || !periodId) return [];
      const { data } = await apiClient.get(`/${accountId}/periods/${periodId}/budgets`);
      return data;
    },
    enabled: !!accountId && !!periodId,
  });
}
