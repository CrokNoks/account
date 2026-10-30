import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';
import { toast } from 'sonner';
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
      toast.success(t('updated'));
    },
    onError: () => {
      toast.error(t('update_error'));
    },
  });
}
