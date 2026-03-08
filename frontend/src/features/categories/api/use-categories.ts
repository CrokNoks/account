import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';

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
}

export function useCategories(accountId: string | null) {
  return useQuery<Category[]>({
    queryKey: ['categories', accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data } = await apiClient.get(`/${accountId}/categories`);
      return data;
    },
    enabled: !!accountId,
  });
}
