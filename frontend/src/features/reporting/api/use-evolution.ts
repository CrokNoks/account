import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';

export interface EvolutionDataPoint {
  periodId: string;
  startDate: string;
  endDate: string;
  realIncome: string;
  realExpenses: string;
  forecastBalance: string;
  realBankBalance: string;
  categories?: Record<string, string>;
}

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
