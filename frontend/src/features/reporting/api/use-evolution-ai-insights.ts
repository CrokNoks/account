import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';

export function useEvolutionAIInsights(accountId: string | null, locale: string = 'fr') {
  return useQuery({
    queryKey: ['evolution-ai-insights', accountId, locale],
    queryFn: async () => {
      if (!accountId) return null;
      const { data } = await apiClient.get(`/${accountId}/reporting/evolution/ai-insights`, {
        params: { locale }
      });
      return data.insights as string;
    },
    enabled: !!accountId,
    staleTime: 1000 * 60 * 60, // 1 hour (evolution trends don't change fast)
  });
}
