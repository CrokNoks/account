import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';

export interface SavingsGoal {
  id: string;
  accountId: string;
  name: string;
  targetAmount: string;
  currentAmount: string;
  deadline: string | null;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export function useSavingsGoals(accountId: string | null) {
  return useQuery<SavingsGoal[]>({
    queryKey: ['savings-goals', accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data } = await apiClient.get(`/${accountId}/savings-goals`);
      return data;
    },
    enabled: !!accountId,
  });
}

export function useCreateSavingsGoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ accountId, data }: { accountId: string, data: Partial<SavingsGoal> }) => {
      const { data: result } = await apiClient.post(`/${accountId}/savings-goals`, data);
      return result;
    },
    onSuccess: (_, { accountId }) => {
      queryClient.invalidateQueries({ queryKey: ['savings-goals', accountId] });
    },
  });
}

export function useUpdateSavingsGoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ accountId, id, data }: { accountId: string, id: string, data: Partial<SavingsGoal> }) => {
      const { data: result } = await apiClient.patch(`/${accountId}/savings-goals/${id}`, data);
      return result;
    },
    onSuccess: (_, { accountId }) => {
      queryClient.invalidateQueries({ queryKey: ['savings-goals', accountId] });
    },
  });
}

export function useDeleteSavingsGoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ accountId, id }: { accountId: string, id: string }) => {
      await apiClient.delete(`/${accountId}/savings-goals/${id}`);
    },
    onSuccess: (_, { accountId }) => {
      queryClient.invalidateQueries({ queryKey: ['savings-goals', accountId] });
    },
  });
}
