import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';
import { TagDetails } from '../model/types';

export function useTagDetails(accountId: string | null, tagId: string | null, periodId?: string | null) {
  return useQuery<TagDetails | null>({
    queryKey: ['tag-details', accountId, tagId, periodId],
    queryFn: async () => {
      if (!accountId || !tagId) return null;
      const params = periodId ? { periodId } : {};
      const { data } = await apiClient.get(`/${accountId}/reporting/tags/${tagId}`, { params });
      return data;
    },
    enabled: !!accountId && !!tagId,
  });
}
