import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';

export interface Transaction {
  id: string;
  accountId: string;
  categoryId: string | null;
  periodId: string | null;
  date: string;
  description: string;
  amount: string;
  reconciled: boolean;
  paymentMethod: string | null;
  notes: string | null;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export function useTransactions(accountId: string | null, periodId?: string | null) {
  return useQuery<Transaction[]>({
    queryKey: ['transactions', accountId, periodId],
    queryFn: async () => {
      if (!accountId) return [];
      const params = periodId ? { periodId } : {};
      const { data } = await apiClient.get(`/${accountId}/transactions`, { params });
      return data;
    },
    enabled: !!accountId,
  });
}
