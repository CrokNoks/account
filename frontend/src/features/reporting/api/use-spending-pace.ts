import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';
import { SpendingPace } from '../model/types';

export function useSpendingPace(accountId: string | null, periodId: string | null) {
  return useQuery<SpendingPace>({
    queryKey: ['reporting', 'spending-pace', accountId, periodId],
    queryFn: async () => {
      if (!accountId || !periodId) throw new Error('Missing accountId or periodId');
      const { data } = await apiClient.get(`/${accountId}/periods/${periodId}/reporting/spending-pace`);
      return data;
    },
    enabled: !!accountId && !!periodId,
  });
}
