import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';

export function useUpdatePeriod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ accountId, id, data }: { accountId: string, id: string, data: any }) => {
      const { data: result } = await apiClient.patch(`/${accountId}/periods/${id}`, data);
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['periods', variables.accountId] });
      queryClient.invalidateQueries({ queryKey: ['reporting'] });
    },
  });
}
