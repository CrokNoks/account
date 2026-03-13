import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';

export interface Anomaly {
  id: string;
  type: 'duplicate' | 'spike' | 'outlier';
  title: string;
  description: string;
  severity: 'medium' | 'high';
  transactionIds: string[];
}

export function useAnomalies(accountId: string | null, periodId?: string | null) {
  return useQuery<Anomaly[]>({
    queryKey: ['anomalies', accountId, periodId],
    queryFn: async () => {
      if (!accountId) return [];
      const params = periodId ? { periodId } : {};
      const { data } = await apiClient.get(`/${accountId}/reporting/anomalies`, { params });
      return data;
    },
    enabled: !!accountId,
    // Polling is not usually needed for anomalies unless actively importing
    staleTime: 5 * 60 * 1000, 
  });
}
