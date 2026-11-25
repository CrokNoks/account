import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';
import { extractPeriodSwitch } from '../model/period-switch';

export interface BulkCreateTransactionsData {
  accountId: string;
  transactions: Array<{
    categoryId: string | null;
    periodId?: string | null;
    date: string;
    description: string;
    amount: string;
    reconciled?: boolean;
  }>;
}

export function useBulkCreateTransactions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: BulkCreateTransactionsData) => {
      const { accountId, transactions } = data;
      const response = await apiClient.post(`/${accountId}/transactions/bulk`, { transactions });
      return response.data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['transactions', variables.accountId] });
      queryClient.invalidateQueries({ queryKey: ['reporting'] });
      // Une bascule de période (déclencheur) change aussi les périodes et le budget affichés.
      if (extractPeriodSwitch(data)) {
        queryClient.invalidateQueries({ queryKey: ['periods', variables.accountId] });
      }
    },
  });
}
