import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';

export interface RecurringTransaction {
  id: string;
  accountId: string;
  categoryId: string | null;
  description: string;
  amount: string;
  dayOfMonth: number;
}

export function useRecurringTransactions(accountId: string | null) {
  return useQuery<RecurringTransaction[]>({
    queryKey: ['recurring-transactions', accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data } = await apiClient.get(`/${accountId}/recurring`);
      return data;
    },
    enabled: !!accountId,
  });
}
