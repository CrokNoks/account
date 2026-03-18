import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';
import { EvolutionDataPoint } from '../model/types';

export function useEvolution(accountId: string | null) {
  return useQuery<EvolutionDataPoint[]>({
    queryKey: ['evolution', accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data } = await apiClient.get(`/${accountId}/reporting/evolution`);
      return data;
    },
    enabled: !!accountId,
  });
}
