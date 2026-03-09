import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';

export interface AccountShare {
  id: string;
  accountId: string;
  userId: string;
  userEmail: string;
  permission: 'read' | 'write';
  createdAt: string;
}

export function useAccountShares(accountId: string | null) {
  return useQuery({
    queryKey: ['account-shares', accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data } = await apiClient.get(`/accounts/${accountId}/shares`);
      return data as AccountShare[];
    },
    enabled: !!accountId,
  });
}
