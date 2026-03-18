import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';
import { PeriodComparisonResponse } from '../model/types';

export function usePeriodComparison(accountId: string | null, periodId: string | null, compareWithId: string | null) {
  return useQuery({
    queryKey: ['period-comparison', accountId, periodId, compareWithId],
    queryFn: async () => {
      if (!accountId || !periodId || !compareWithId) return null;
      const { data } = await apiClient.get(`/${accountId}/periods/${periodId}/reporting/comparison`, {
        params: { compareWith: compareWithId }
      });
      return data as PeriodComparisonResponse;
    },
    enabled: !!accountId && !!periodId && !!compareWithId,
  });
}
