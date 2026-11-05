import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';
import { CategoryOverrunsChartResponse, OverrunsByPeriodResponse } from '../model/types';

export function useOverrunsByPeriod(accountId: string | null) {
  return useQuery<OverrunsByPeriodResponse>({
    queryKey: ['reporting', 'overruns', accountId],
    queryFn: async () => {
      if (!accountId) throw new Error('Missing accountId');
      const { data } = await apiClient.get(`/${accountId}/reporting/overruns`);
      return data;
    },
    enabled: !!accountId,
  });
}

export function useCategoryOverrunsChart(
  accountId: string | null,
  categoryId: string | null,
  startPeriodId: string | null,
  endPeriodId: string | null,
) {
  return useQuery<CategoryOverrunsChartResponse>({
    queryKey: ['reporting', 'overruns-chart', accountId, categoryId, startPeriodId, endPeriodId],
    queryFn: async () => {
      if (!accountId || !categoryId || !startPeriodId || !endPeriodId) throw new Error('Missing parameters');
      const { data } = await apiClient.get(`/${accountId}/reporting/overruns-chart`, {
        params: { categoryId, startPeriodId, endPeriodId },
      });
      return data;
    },
    enabled: !!accountId && !!categoryId && !!startPeriodId && !!endPeriodId,
  });
}
