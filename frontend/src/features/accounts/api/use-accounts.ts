import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';
import { Account } from '../model/types';

export function useAccounts() {
  return useQuery<Account[]>({
    queryKey: ['accounts'],
    queryFn: async () => {
      const { data } = await apiClient.get('/accounts');
      return data;
    },
  });
}
