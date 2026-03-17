import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';

export interface BulkUpdateCommand {
  ids: string[];
  data: {
    categoryId?: string | null;
    tagIds?: string[];
    reconciled?: boolean;
    pending?: boolean;
  };
}

export function useBulkUpdateTransactions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ accountId, command }: { accountId: string, command: BulkUpdateCommand }) => {
      await apiClient.patch(`/${accountId}/transactions/bulk`, command);
    },
    onSuccess: (_, { accountId }) => {
      queryClient.invalidateQueries({ queryKey: ['transactions', accountId] });
    },
  });
}

export function useBulkDeleteTransactions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ accountId, ids }: { accountId: string, ids: string[] }) => {
      await apiClient.delete(`/${accountId}/transactions/bulk`, { data: { ids } });
    },
    onSuccess: (_, { accountId }) => {
      queryClient.invalidateQueries({ queryKey: ['transactions', accountId] });
    },
  });
}
