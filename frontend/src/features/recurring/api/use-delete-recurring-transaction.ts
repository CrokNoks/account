import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/shared/api/mutation-error';
import { useTranslations } from 'next-intl';
import { DeleteRecurringTransactionData } from '../model/types';

export function useDeleteRecurringTransaction() {
  const queryClient = useQueryClient();
  const t = useTranslations('Recurring');
  const tApi = useTranslations('ApiErrors');

  return useMutation({
    mutationFn: async ({ accountId, id }: DeleteRecurringTransactionData) => {
      await apiClient.delete(`/${accountId}/recurring/${id}`);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['recurring-transactions', variables.accountId] });
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, t('delete_error'), tApi));
    },
  });
}
