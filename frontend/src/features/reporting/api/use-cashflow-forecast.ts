import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';
import { CashflowForecastResponse } from '../model/types';

export function useCashflowForecast(accountId: string | null, days: number = 90) {
  return useQuery({
    queryKey: ['cashflow-forecast', accountId, days],
    queryFn: async () => {
      if (!accountId) return null;
      const { data } = await apiClient.get(`/${accountId}/reporting/cashflow`, {
        params: { days }
      });
      return data as CashflowForecastResponse;
    },
    enabled: !!accountId,
  });
}
