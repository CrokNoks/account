import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';

export interface CreateCategoryCommand {
  accountId: string;
  name: string;
  color: string;
  type: string;
  budget?: string;
}

export function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (command: CreateCategoryCommand) => {
      const { accountId, ...body } = command;
      const { data } = await apiClient.post(`/${accountId}/categories`, body);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['categories', variables.accountId] });
    },
  });
}
