import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';

export interface Period {
  id: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export function usePeriods(accountId: string | null) {
  return useQuery<Period[]>({
    queryKey: ['periods', accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data } = await apiClient.get(`/${accountId}/periods`);
      return data;
    },
    enabled: !!accountId,
  });
}
