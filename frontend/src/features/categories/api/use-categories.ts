import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';
import { Category } from '../model/types';

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
