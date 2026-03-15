import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';

interface IgnoreAnomalyPayload {
  accountId: string;
  transactionIds: string[];
  type: string;
}

export function useIgnoreAnomaly(periodId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ accountId, transactionIds, type }: IgnoreAnomalyPayload) => {
      const { data } = await apiClient.post(
        `/${accountId}/reporting/anomalies/ignore`,
        { transactionIds, type }
      );
      return data;
    },
    onSuccess: (_, { accountId }) => {
      // Invalidate anomalies to remove the dismissed one from the list
      queryClient.invalidateQueries({
        queryKey: ['anomalies', accountId, periodId],
      });
      // Optionally invalidate transactions if we want to fetch the updated metadata
      queryClient.invalidateQueries({
        queryKey: ['transactions', accountId],
      });
    },
  });
}
