import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';
import { TagSummary } from '../model/types';

export function useTagsSummary(accountId: string | null, periodId?: string | null) {
  return useQuery<TagSummary[]>({
    queryKey: ['tags-summary', accountId, periodId],
    queryFn: async () => {
      if (!accountId) return [];
      const params = periodId ? { periodId } : {};
      const { data } = await apiClient.get(`/${accountId}/reporting/tags-summary`, { params });
      return data;
    },
    enabled: !!accountId,
  });
}
