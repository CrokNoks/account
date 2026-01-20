import { useQuery } from '@tanstack/react-query';
import { supabaseClient } from '../supabaseClient';

interface UseQueryWithSkeletonProps<T> {
  queryKey: any[];
  queryFn: () => Promise<T>;
  skeletonType: 'expense' | 'expenses' | 'category' | 'categories' | 'report' | 'account' | 'accounts' | 'form' | 'table';
  skeletonCount?: number;
  skeletonColumns?: number;
  enabled?: boolean;
  staleTime?: number;
  gcTime?: number;
  refetchOnWindowFocus?: boolean;
}

export const useQueryWithSkeleton = <T>({
  queryKey,
  queryFn,
  skeletonType,
  skeletonCount,
  skeletonColumns,
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
  accountId: string | null,
  skeletonCount = 5,
  startDate?: string,
  endDate?: string
) => {
  return useQueryWithSkeleton({
    queryKey: accountId ? 
    [`expenses`, accountId, startDate, endDate] :
    ['expenses'], // Fallback query key
    queryFn: async () => {
      if (!accountId) return [];
      
      let query = supabaseClient
        .from('expenses')
        .select('*')
        .eq('account_id', accountId);
      
      if (startDate) {
        query = query.gte('date', startDate);
      }
      
      if (endDate) {
        query = query.lte('date', endDate);
      }
      
      const { data, error } = await query.order('date', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    skeletonType: 'expenses',
    skeletonCount,
    enabled: !!accountId,
    staleTime: 1000 * 60 * 2 // 2 minutes
  });
};

export const useCategoriesWithSkeleton = (
  accountId: string | null,
  skeletonCount = 5
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
    skeletonType: 'categories',
    skeletonCount,
    enabled: !!accountId,
    staleTime: 1000 * 60 * 5 // 5 minutes
  });
};

export const useAccountsWithSkeleton = (skeletonCount = 3) => {
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
    skeletonType: 'accounts',
    skeletonCount,
    enabled: true,
    staleTime: 1000 * 60 * 5 // 5 minutes
  });
};