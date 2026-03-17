import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';

export interface NetWorthDataPoint {
  date: string;
  amount: string;
}

export interface NetWorthResponse {
  currentTotal: string;
  history: NetWorthDataPoint[];
}

export function useNetWorth(accountId: string | null) {
  return useQuery<NetWorthResponse>({
    queryKey: ['net-worth', accountId],
    queryFn: async () => {
      // accountId is passed in the URL, but the backend use case fetches all accounts
      const { data } = await apiClient.get(`/${accountId}/reporting/net-worth`);
      return data;
    },
    enabled: !!accountId,
  });
}
