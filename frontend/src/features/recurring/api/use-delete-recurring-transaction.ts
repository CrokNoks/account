import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';
import { toast } from 'sonner';
import { DeleteRecurringTransactionData } from '../model/types';

export function useDeleteRecurringTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ accountId, id }: DeleteRecurringTransactionData) => {
      await apiClient.delete(`/${accountId}/recurring/${id}`);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['recurring-transactions', variables.accountId] });
      toast.success('Recurring transaction deleted');
    },
    onError: () => {
      toast.error('Failed to delete recurring transaction');
    },
  });
}
