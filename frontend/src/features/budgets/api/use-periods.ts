import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';
import { Period } from '@/features/periods/model/types';

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
