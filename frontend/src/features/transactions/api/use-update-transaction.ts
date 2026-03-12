import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';
import { Transaction } from './use-transactions';

export function useUpdateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ accountId, id, data }: { accountId: string, id: string, data: Partial<Transaction> }) => {
      const { data: result } = await apiClient.patch(`/${accountId}/transactions/${id}`, data);
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['transactions', variables.accountId] });
      queryClient.invalidateQueries({ queryKey: ['reporting'] });
    },
  });
}
