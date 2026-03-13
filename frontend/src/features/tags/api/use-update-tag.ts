import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';

export interface UpdateTagCommand {
  id: string;
  accountId: string;
  name?: string;
  color?: string;
}

export function useUpdateTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (command: UpdateTagCommand) => {
      const { id, accountId, ...body } = command;
      const { data } = await apiClient.patch(`/${accountId}/tags/${id}`, body);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tags', variables.accountId] });
    },
  });
}
