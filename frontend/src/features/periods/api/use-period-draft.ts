import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';
import { PeriodDraft } from '../model/types';

export function usePeriodDraft(accountId: string | null) {
  return useQuery<PeriodDraft>({
    queryKey: ['periods', 'draft', accountId],
    queryFn: async () => {
      if (!accountId) throw new Error('Account ID is required');
      const { data } = await apiClient.get(`/${accountId}/periods/draft-init`);
      return data;
    },
    enabled: !!accountId,
  });
}
