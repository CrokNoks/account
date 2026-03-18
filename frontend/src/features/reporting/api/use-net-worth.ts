import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';
import { NetWorthResponse } from '../model/types';

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
