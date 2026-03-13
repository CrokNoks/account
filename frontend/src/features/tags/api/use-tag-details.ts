import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';
import { TagSummary } from './use-tags-summary';
import { Transaction } from '../../transactions/api/use-transactions';

export interface TagCategoryBreakdown {
  categoryId: string | null;
  name: string;
  amount: string;
  percentage: number;
}

export interface TagRecentTransaction {
  id: string;
  description: string;
  date: string;
  amount: string;
}

export interface TagDetails {
  summary: TagSummary;
  categoryBreakdown: TagCategoryBreakdown[];
  recentTransactions: TagRecentTransaction[];
}

export function useTagDetails(accountId: string | null, tagId: string | null, periodId?: string | null) {
  return useQuery<TagDetails>({
    queryKey: ['tag-details', accountId, tagId, periodId],
    queryFn: async () => {
      if (!accountId || !tagId) return null as any;
      const params = periodId ? { periodId } : {};
      const { data } = await apiClient.get(`/${accountId}/reporting/tags/${tagId}`, { params });
      return data;
    },
    enabled: !!accountId && !!tagId,
  });
}
