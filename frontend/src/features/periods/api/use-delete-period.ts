import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';

export function useDeletePeriod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ accountId, id }: { accountId: string, id: string }) => {
      await apiClient.delete(`/${accountId}/periods/${id}`);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['periods', variables.accountId] });
      queryClient.invalidateQueries({ queryKey: ['reporting'] });
    },
  });
}
