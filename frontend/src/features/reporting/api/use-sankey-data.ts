import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';
import { SankeyDataResponse } from '../model/types';

export function useSankeyData(accountId: string | null, periodId: string | null) {
  return useQuery({
    queryKey: ['sankey-data', accountId, periodId],
    queryFn: async () => {
      if (!accountId || !periodId) return null;
      const { data } = await apiClient.get(`/${accountId}/periods/${periodId}/reporting/sankey`);
      return data as SankeyDataResponse;
    },
    enabled: !!accountId && !!periodId,
  });
}
