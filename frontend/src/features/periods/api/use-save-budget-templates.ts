import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';
import { SaveBudgetTemplatesData } from '../model/types';

export function useSaveBudgetTemplates() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ accountId, items }: SaveBudgetTemplatesData) => {
      await apiClient.put(`/${accountId}/budget-templates`, { items });
    },
    // Succès comme échec : l'écran et la création de période relisent l'état réel
    // (catégorie supprimée ou ajoutée pendant que l'écran était ouvert).
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['periods', 'budget-templates'] });
      queryClient.invalidateQueries({ queryKey: ['periods', 'draft'] });
    },
  });
}
