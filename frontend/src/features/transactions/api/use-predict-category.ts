import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';

export function usePredictCategory(accountId: string | null, description: string) {
  return useQuery({
    queryKey: ['predict-category', accountId, description],
    queryFn: async () => {
      if (!accountId || !description || description.length < 3) return { categoryId: null };
      const { data } = await apiClient.get(`/${accountId}/transactions/predict-category`, {
        params: { description }
      });
      return data as { categoryId: string | null };
    },
    enabled: !!accountId && description.length >= 3,
    staleTime: 1000 * 60 * 5, // Cache results for 5 minutes
  });
}
