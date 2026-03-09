import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';
import { toast } from 'sonner';

export interface CreateRecurringTransactionData {
  accountId: string;
  categoryId: string | null;
  description: string;
  amount: string;
  dayOfMonth: number;
}

export function useCreateRecurringTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateRecurringTransactionData) => {
      const { accountId, ...rest } = data;
      const response = await apiClient.post(`/${accountId}/recurring`, rest);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['recurring-transactions', variables.accountId] });
      toast.success('Recurring transaction created');
    },
    onError: () => {
      toast.error('Failed to create recurring transaction');
    },
  });
}
