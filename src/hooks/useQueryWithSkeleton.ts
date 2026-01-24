import { useQuery } from '@tanstack/react-query';
import { dataProvider } from '../providers/dataProvider';

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
      
      const { data } = await dataProvider.getList('expenses', {
        filter: { account_id: accountId },
        pagination: { page: 1, perPage: 500 },
        sort: { field: 'date', order: 'DESC' }
      });
      
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
      
      const { data } = await dataProvider.getList('categories', {
        filter: { account_id: accountId },
        pagination: { page: 1, perPage: 100 },
        sort: { field: 'name', order: 'ASC' }
      });
      
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
      const { data } = await dataProvider.getList('accounts', {
        pagination: { page: 1, perPage: 100 },
        sort: { field: 'created_at', order: 'DESC' }
      });
      
      return data;
    },

    enabled: true,
    staleTime: 1000 * 60 * 5 // 5 minutes
  });
};