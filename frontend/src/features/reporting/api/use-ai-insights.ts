import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';

export function useAIInsights(accountId: string | null, periodId: string | null, locale: string = 'fr') {
  return useQuery({
    queryKey: ['ai-insights', accountId, periodId, locale],
    queryFn: async () => {
      if (!accountId || !periodId) return null;
      const { data } = await apiClient.get(`/${accountId}/periods/${periodId}/reporting/ai-insights`, {
        params: { locale }
      });
      return data.insights as string;
    },
    enabled: !!accountId && !!periodId,
    staleTime: 1000 * 60 * 30, // 30 minutes
  });
}
