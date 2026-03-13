import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';

export interface Tag {
  id: string;
  accountId: string;
  name: string;
  color?: string;
}

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
