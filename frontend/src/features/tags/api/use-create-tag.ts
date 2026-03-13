import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';

export interface CreateTagCommand {
  accountId: string;
  name: string;
  color?: string;
}

export function useCreateTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (command: CreateTagCommand) => {
      const { accountId, ...body } = command;
      const { data } = await apiClient.post(`/${accountId}/tags`, body);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tags', variables.accountId] });
    },
  });
}
