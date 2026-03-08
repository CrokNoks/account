import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';

export interface PeriodStats {
  startBalance: string;
  realIncome: string;
  plannedIncome: string;
  realExpenses: string;
  plannedExpenses: string;
  realBankBalance: string;
  upcomingBalance: string;
  forecastBalance: string;
}

export function useReportingStats(accountId: string | null, periodId: string | null) {
  return useQuery<PeriodStats>({
    queryKey: ['reporting', 'stats', accountId, periodId],
    queryFn: async () => {
      if (!accountId || !periodId) throw new Error('Missing accountId or periodId');
      const { data } = await apiClient.get(`/${accountId}/periods/${periodId}/reporting/stats`);
      return data;
    },
    enabled: !!accountId && !!periodId,
  });
}
