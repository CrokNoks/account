import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/shared/api/mutation-error';
import { useTranslations } from 'next-intl';
import { UpdateRecurringTransactionData } from '../model/types';

export function useUpdateRecurringTransaction() {
  const queryClient = useQueryClient();
  const t = useTranslations('Recurring');

  return useMutation({
    mutationFn: async ({ accountId, id, data }: UpdateRecurringTransactionData) => {
      const response = await apiClient.patch(`/${accountId}/recurring/${id}`, data);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['recurring-transactions', variables.accountId] });
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, t('update_error')));
    },
  });
}
