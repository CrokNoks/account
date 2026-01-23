import { useQuery } from '@tanstack/react-query';
import { supabaseClient } from '../supabaseClient';

interface UseQueryWithSkeletonProps<T> {
  queryKey: any[];
  queryFn: () => Promise<T>;
  enabled?: boolean;
  staleTime?: number;
  gcTime?: number;
  refetchOnWindowFocus?: boolean;
}

export const useQueryWithSkeleton = <T>({
  queryKey,
  queryFn,
  enabled = true,
  staleTime,
  gcTime,
  refetchOnWindowFocus,
}: UseQueryWithSkeletonProps<T>) => {
  const query = useQuery({
    queryKey,
    queryFn,
    enabled,
    staleTime,
    gcTime,
    refetchOnWindowFocus,
  });

  return {
    ...query,
    isLoadingWithSkeleton: query.isLoading || query.isFetching,
  };
};

// Specific hooks for common use cases
export const useExpensesWithSkeleton = (
  accountId: string | null
) => {
  return useQueryWithSkeleton({
    queryKey: accountId ? ['expenses', accountId] : ['expenses'],
    queryFn: async () => {
      if (!accountId) return [];
      
      const { data, error } = await supabaseClient
        .from('expenses')
        .select('*')
        .eq('account_id', accountId)
        .order('date', { ascending: false });
      
      if (error) throw error;
      return data;
    },

    enabled: !!accountId,
    staleTime: 1000 * 60 * 2 // 2 minutes
  });
};

export const useCategoriesWithSkeleton = (
  accountId: string | null
) => {
  return useQueryWithSkeleton({
    queryKey: accountId ? ['categories', accountId] : ['categories'],
    queryFn: async () => {
      if (!accountId) return [];
      
      const { data, error } = await supabaseClient
        .from('categories')
        .select('*')
        .eq('account_id', accountId)
        .order('name', { ascending: true });
      
      if (error) throw error;
      return data;
    },

    enabled: !!accountId,
    staleTime: 1000 * 60 * 5 // 5 minutes
  });
};

export const useAccountsWithSkeleton = () => {
  return useQueryWithSkeleton({
    queryKey: ['accounts'],
    queryFn: async () => {
      const { data, error } = await supabaseClient
        .from('accounts')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },

    enabled: true,
    staleTime: 1000 * 60 * 5 // 5 minutes
  });
};