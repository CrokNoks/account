import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';
import { Tag } from '../model/types';

export function useTags(accountId: string | null) {
  return useQuery<Tag[]>({
    queryKey: ['tags', accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data } = await apiClient.get(`/${accountId}/tags`);
      return data;
    },
    enabled: !!accountId,
  });
}
