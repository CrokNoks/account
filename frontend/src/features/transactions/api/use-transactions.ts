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
  pending: boolean;
  paymentMethod: string | null;
  notes: string | null;
  metadata: Record<string, unknown> | null;
  tagIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface FindTransactionsOptions {
  periodId?: string | null;
  search?: string;
  categoryId?: string | null;
  tagIds?: string[];
  minAmount?: string;
  maxAmount?: string;
  reconciled?: boolean;
  startDate?: string;
  endDate?: string;
}

export function useTransactions(accountId: string | null, options: FindTransactionsOptions = {}) {
  return useQuery<Transaction[]>({
    queryKey: ['transactions', accountId, options],
    queryFn: async () => {
      if (!accountId) return [];
      const { data } = await apiClient.get(`/${accountId}/transactions`, { params: options });
      return data;
    },
    enabled: !!accountId,
  });
}
