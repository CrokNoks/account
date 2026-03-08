import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';

export interface Account {
  id: string;
  name: string;
  type: string;
  currency: string;
  initialBalance: string;
  balance?: string;
}

export function useAccounts() {
  return useQuery<Account[]>({
    queryKey: ['accounts'],
    queryFn: async () => {
      const { data } = await apiClient.get('/accounts');
      return data;
    },
  });
}
