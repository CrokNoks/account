import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';

export function useManageShare() {
  const queryClient = useQueryClient();

  const shareMutation = useMutation({
    mutationFn: async ({ accountId, email, permission }: { accountId: string, email: string, permission: 'read' | 'write' }) => {
      await apiClient.post(`/accounts/${accountId}/shares`, { email, permission });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['account-shares', variables.accountId] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async ({ accountId, userId }: { accountId: string, userId: string }) => {
      await apiClient.delete(`/accounts/${accountId}/shares/${userId}`);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['account-shares', variables.accountId] });
    },
  });

  return {
    share: shareMutation.mutate,
    isSharing: shareMutation.isPending,
    remove: removeMutation.mutate,
    isRemoving: removeMutation.isPending,
  };
}
