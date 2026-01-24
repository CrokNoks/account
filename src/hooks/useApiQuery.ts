import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNotify } from 'react-admin';
import { dataProvider } from '../providers/dataProvider';

// Types - Réutiliser les mêmes interfaces pour compatibilité
export interface Account {
  id: string;
  name: string;
  initial_balance: number;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  budget: number;
  type: 'income' | 'expense';
  account_id: string;
}

export interface Expense {
  id: string;
  amount: number;
  description: string;
  date: string;
  reconciled: boolean;
  category_id: string;
  account_id: string;
}

// Query keys - Garder les mêmes pour compatibilité cache
export const queryKeys = {
  accounts: ['accounts'] as const,
  categories: (accountId: string) => ['categories', accountId] as const,
  expenses: (accountId: string, startDate?: string, endDate?: string) => 
    ['expenses', accountId, startDate, endDate] as const,
  reports: (accountId: string) => ['reports', accountId] as const,
};

// Hooks for Accounts
export const useAccounts = () => {
  return useQuery({
    queryKey: queryKeys.accounts,
    queryFn: async () => {
      const { data } = await dataProvider.getList('accounts', {
        pagination: { page: 1, perPage: 100 },
        sort: { field: 'created_at', order: 'DESC' }
      });
      return data as Account[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};

// Hooks for Categories
export const useCategories = (accountId: string | null) => {
  return useQuery({
    queryKey: queryKeys.categories(accountId || ''),
    queryFn: async () => {
      if (!accountId) return [];
      
      const { data } = await dataProvider.getList('categories', {
        filter: { account_id: accountId },
        pagination: { page: 1, perPage: 100 },
        sort: { field: 'name', order: 'ASC' }
      });
      return data as Category[];
    },
    enabled: !!accountId,
    staleTime: 5 * 60 * 1000,
  });
};

// Hooks for Expenses
export const useExpenses = (
  accountId: string | null,
  startDate?: string,
  endDate?: string
) => {
  return useQuery({
    queryKey: queryKeys.expenses(accountId || '', startDate, endDate),
    queryFn: async () => {
      if (!accountId) return [];
      
      const filter: any = { account_id: accountId };
      if (startDate) filter.date_gte = startDate;
      if (endDate) filter.date_lte = endDate;
      
      const { data } = await dataProvider.getList('expenses', {
        filter,
        pagination: { page: 1, perPage: 500 },
        sort: { field: 'date', order: 'DESC' }
      });
      return data as Expense[];
    },
    enabled: !!accountId,
    staleTime: 2 * 60 * 1000, // 2 minutes - expenses change more frequently
  });
};

// Hooks for Reports
export const useReports = (accountId: string | null) => {
  return useQuery({
    queryKey: queryKeys.reports(accountId || ''),
    queryFn: async () => {
      if (!accountId) return [];
      
      const { data } = await dataProvider.getList('periods', {
        filter: { account_id: accountId },
        pagination: { page: 1, perPage: 100 },
        sort: { field: 'end_date', order: 'DESC' }
      });
      return data;
    },
    enabled: !!accountId,
    staleTime: 5 * 60 * 1000,
  });
};

// Mutations
export const useUpdateExpense = () => {
  const queryClient = useQueryClient();
  const notify = useNotify();

  return useMutation({
    mutationFn: async ({ 
      id, 
      data 
    }: { 
      id: string; 
      data: Partial<Expense> 
    }) => {
      await dataProvider.update('expenses', {
        id,
        data,
        previousData: {} as Expense
      });
      return { id, data };
    },
    onSuccess: () => {
      // Invalidate all expense queries to trigger refetch
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      
      notify('Expense updated successfully', { 
        type: 'success',
        undoable: false 
      });
    },
    onError: (error: any) => {
      notify(`Error updating expense: ${error.message}`, { 
        type: 'error' 
      });
    },
  });
};

export const useCreateExpense = () => {
  const queryClient = useQueryClient();
  const notify = useNotify();

  return useMutation({
    mutationFn: async (data: Omit<Expense, 'id' | 'created_at'>) => {
      const result = await dataProvider.create('expenses', { data });
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      notify('Expense created successfully', { type: 'success' });
    },
    onError: (error: any) => {
      notify(`Error creating expense: ${error.message}`, { type: 'error' });
    },
  });
};

export const useDeleteExpense = () => {
  const queryClient = useQueryClient();
  const notify = useNotify();

  return useMutation({
    mutationFn: async (id: string) => {
      await dataProvider.delete('expenses', { id, previousData: {} as Expense });
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      notify('Expense deleted successfully', { type: 'success' });
    },
    onError: (error: any) => {
      notify(`Error deleting expense: ${error.message}`, { type: 'error' });
    },
  });
};

// Utility hook for optimistic updates
export const useOptimisticExpenseUpdate = () => {
  const queryClient = useQueryClient();
  const notify = useNotify();

  return useMutation({
    mutationFn: async ({ 
      id, 
      data 
    }: { 
      id: string; 
      data: Partial<Expense>;
    }) => {
      await dataProvider.update('expenses', {
        id,
        data,
        previousData: {} as Expense
      });
      return { id, data };
    },
    onMutate: async ({ id, data }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['expenses'] });
      
      // Snapshot previous value
      const previousExpenses = queryClient.getQueriesData({ queryKey: ['expenses'] });
      
      // Optimistically update to the new value
      queryClient.setQueriesData(
        { queryKey: ['expenses'] },
        (old: Expense[] | undefined) => {
          if (!old) return [];
          return old.map(expense => 
            expense.id === id 
              ? { ...expense, ...data }
              : expense
          );
        }
      );
      
      return { previousExpenses };
    },
    onError: (error: any, _variables, context) => {
      // Rollback to previous value
      if (context?.previousExpenses) {
        queryClient.setQueriesData(
          { queryKey: ['expenses'] },
          context.previousExpenses
        );
      }
      
      notify(`Error updating expense: ${error.message}`, { type: 'error' });
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    },
  });
};