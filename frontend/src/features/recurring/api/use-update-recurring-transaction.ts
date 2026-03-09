import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';
import { toast } from 'sonner';

export interface UpdateRecurringTransactionData {
  accountId: string;
  id: string;
  data: {
    categoryId?: string | null;
    description?: string;
    amount?: string;
    dayOfMonth?: number;
  };
}

export function useUpdateRecurringTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ accountId, id, data }: UpdateRecurringTransactionData) => {
      const response = await apiClient.patch(`/${accountId}/recurring/${id}`, data);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['recurring-transactions', variables.accountId] });
      toast.success('Recurring transaction updated');
    },
    onError: () => {
      toast.error('Failed to update recurring transaction');
    },
  });
}
