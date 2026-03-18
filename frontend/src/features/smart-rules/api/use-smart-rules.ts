import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';

export interface SmartRule {
  id: string;
  accountId: string;
  pattern: string;
  categoryId: string | null;
  tagIds: string[];
  priority: number;
  createdAt: string;
  updatedAt: string;
}

export function useSmartRules(accountId: string | null) {
  return useQuery<SmartRule[]>({
    queryKey: ['smart-rules', accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data } = await apiClient.get(`/${accountId}/smart-rules`);
      return data;
    },
    enabled: !!accountId,
  });
}

export function useCreateSmartRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ accountId, data }: { accountId: string, data: Partial<SmartRule> }) => {
      const { data: result } = await apiClient.post(`/${accountId}/smart-rules`, data);
      return result;
    },
    onSuccess: (_, { accountId }) => {
      queryClient.invalidateQueries({ queryKey: ['smart-rules', accountId] });
    },
  });
}

export function useUpdateSmartRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ accountId, id, data }: { accountId: string, id: string, data: Partial<SmartRule> }) => {
      const { data: result } = await apiClient.patch(`/${accountId}/smart-rules/${id}`, data);
      return result;
    },
    onSuccess: (_, { accountId }) => {
      queryClient.invalidateQueries({ queryKey: ['smart-rules', accountId] });
    },
  });
}

export function useDeleteSmartRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ accountId, id }: { accountId: string, id: string }) => {
      await apiClient.delete(`/${accountId}/smart-rules/${id}`);
    },
    onSuccess: (_, { accountId }) => {
      queryClient.invalidateQueries({ queryKey: ['smart-rules', accountId] });
    },
  });
}
