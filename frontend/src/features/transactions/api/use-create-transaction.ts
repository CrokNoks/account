import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';

export interface CreateTransactionCommand {
  accountId: string;
  categoryId: string | null;
  periodId?: string | null;
  date: string;
  description: string;
  amount: string;
  paymentMethod?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
  pending?: boolean;
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (command: CreateTransactionCommand) => {
      const { accountId, ...body } = command;
      const { data } = await apiClient.post(`/${accountId}/transactions`, body);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['transactions', variables.accountId] });
      queryClient.invalidateQueries({ queryKey: ['reporting'] });
    },
  });
}
