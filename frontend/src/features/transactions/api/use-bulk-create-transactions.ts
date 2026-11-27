import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';
import { extractPeriodSwitch } from '../model/period-switch';

export interface BulkCreateTransactionsData {
  accountId: string;
  transactions: Array<{
    categoryId: string | null;
    date: string;
    description: string;
    amount: string;
    reconciled?: boolean;
  }>;
  /** Counts from the import screen, for measurement only (numbers, no effect on the write). */
  importStats?: { excluded: number; rechecked: number; closeFlagged: number };
}

export function useBulkCreateTransactions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: BulkCreateTransactionsData) => {
      const { accountId, transactions, importStats } = data;
      const response = await apiClient.post(`/${accountId}/transactions/bulk`, { transactions, importStats });
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
