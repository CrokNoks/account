import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';
import { UpdateBudgetsDto } from '../model/types';

export function useUpdatePeriodBudgets() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ accountId, periodId, data }: { accountId: string, periodId: string, data: UpdateBudgetsDto }) => {
      const { data: result } = await apiClient.put(`/${accountId}/periods/${periodId}/budgets`, data);
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['periods', variables.periodId, 'budgets'] });
      queryClient.invalidateQueries({ queryKey: ['reporting'] });
    },
  });
}
