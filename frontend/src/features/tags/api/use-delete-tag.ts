import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';

export interface DeleteTagCommand {
  id: string;
  accountId: string;
}

export function useDeleteTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (command: DeleteTagCommand) => {
      const { id, accountId } = command;
      await apiClient.delete(`/${accountId}/tags/${id}`);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tags', variables.accountId] });
    },
  });
}
