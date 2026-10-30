import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/shared/api/mutation-error';
import { useTranslations } from 'next-intl';
import { CreateRecurringTransactionData } from '../model/types';

export function useCreateRecurringTransaction() {
  const queryClient = useQueryClient();
  const t = useTranslations('Recurring');

  return useMutation({
    mutationFn: async (data: CreateRecurringTransactionData) => {
      const { accountId, ...rest } = data;
      const response = await apiClient.post(`/${accountId}/recurring`, rest);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['recurring-transactions', variables.accountId] });
      toast.success(t('created'));
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, t('create_error')));
    },
  });
}
