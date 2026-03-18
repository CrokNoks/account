import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';
import { SavingsGoal, CreateSavingsGoalData, UpdateSavingsGoalData, DeleteSavingsGoalData } from '../model/types';

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
    mutationFn: async ({ accountId, data }: CreateSavingsGoalData) => {
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
    mutationFn: async ({ accountId, id, data }: UpdateSavingsGoalData) => {
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
    mutationFn: async ({ accountId, id }: DeleteSavingsGoalData) => {
      await apiClient.delete(`/${accountId}/savings-goals/${id}`);
    },
    onSuccess: (_, { accountId }) => {
      queryClient.invalidateQueries({ queryKey: ['savings-goals', accountId] });
    },
  });
}
