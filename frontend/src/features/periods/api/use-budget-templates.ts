import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';
import { BudgetTemplateLine } from '../model/types';

export function useBudgetTemplates(accountId: string | null) {
  return useQuery<BudgetTemplateLine[]>({
    queryKey: ['periods', 'budget-templates', accountId],
    queryFn: async () => {
      if (!accountId) throw new Error('Account ID is required');
      const { data } = await apiClient.get(`/${accountId}/budget-templates`);
      return data;
    },
    enabled: !!accountId,
  });
}
