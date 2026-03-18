import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';
import { FindTransactionsOptions, PaginatedTransactions } from '../model/types';

export function useTransactions(accountId: string | null, options: FindTransactionsOptions = {}) {
  return useQuery<PaginatedTransactions>({
    queryKey: ['transactions', accountId, options],
    queryFn: async () => {
      if (!accountId) return { data: [], meta: { total: 0, page: 1, limit: 1000, totalPages: 0 } };
      const { data } = await apiClient.get(`/${accountId}/transactions`, { params: options });
      return data;
    },
    enabled: !!accountId,
  });
}
