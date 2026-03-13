import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';

export function useDeleteTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ accountId, id }: { accountId: string, id: string }) => {
      await apiClient.delete(`/${accountId}/transactions/${id}`);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['transactions', variables.accountId] });
      queryClient.invalidateQueries({ queryKey: ['reporting'] });
      queryClient.invalidateQueries({ queryKey: ['anomalies', variables.accountId] });
    },
  });
}
