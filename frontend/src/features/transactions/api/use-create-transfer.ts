import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';

export interface CreateTransferCommand {
  sourceAccountId: string;
  destinationAccountId: string;
  amount: string; // amount in cents
  date: string;
  description: string;
}

export function useCreateTransfer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (command: CreateTransferCommand) => {
      const { sourceAccountId, ...body } = command;
      const { data } = await apiClient.post(`/${sourceAccountId}/transactions/transfer`, body);
      return data;
    },
    onSuccess: (_, variables) => {
      // Invalidate both accounts' transaction lists
      queryClient.invalidateQueries({ queryKey: ['transactions', variables.sourceAccountId] });
      queryClient.invalidateQueries({ queryKey: ['transactions', variables.destinationAccountId] });
      
      // Invalidate general things
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['reporting'] });
    },
  });
}
