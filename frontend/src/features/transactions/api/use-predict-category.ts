import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';

export function usePredictCategory() {
  return useMutation({
    mutationFn: async ({ accountId, description }: { accountId: string, description: string }) => {
      if (!description || description.length < 3) return { categoryId: null };
      const { data } = await apiClient.get(`/${accountId}/transactions/predict-category`, {
        params: { description }
      });
      return data as { categoryId: string | null };
    },
  });
}
