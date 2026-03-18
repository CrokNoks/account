import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';
import { CreatePeriodCommand } from '../model/types';

export function useCreatePeriod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (command: CreatePeriodCommand) => {
      const { accountId, ...body } = command;
      const { data } = await apiClient.post(`/${accountId}/periods`, body);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['periods', variables.accountId] });
      queryClient.invalidateQueries({ queryKey: ['periods', 'draft', variables.accountId] });
      queryClient.invalidateQueries({ queryKey: ['transactions', variables.accountId] });
      queryClient.invalidateQueries({ queryKey: ['reporting'] });
    },
  });
}
