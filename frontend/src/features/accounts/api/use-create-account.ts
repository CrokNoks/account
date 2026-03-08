import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';

export interface CreateAccountCommand {
  name: string;
  type: string;
  currency: string;
  initialBalance: string;
}

export function useCreateAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (command: CreateAccountCommand) => {
      const { data } = await apiClient.post('/accounts', command);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}
