import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';

export interface PeriodDraft {
  suggestedStartDate: string;
  suggestedEndDate: string;
  categoriesWithStats: Array<{
    categoryId: string;
    name: string;
    minReal: string;
    maxReal: string;
    avgReal: string;
    defaultAllocated: string;
  }>;
}

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
