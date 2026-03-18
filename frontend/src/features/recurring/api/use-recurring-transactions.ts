import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';
import { RecurringTransaction } from '../model/types';

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
