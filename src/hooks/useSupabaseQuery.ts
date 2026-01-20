import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseClient } from '../supabaseClient';
import { useNotify } from 'react-admin';

// Types
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

// Query keys
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
      const { data, error } = await supabaseClient
        .from('accounts')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
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
      
      const { data, error } = await supabaseClient
        .from('categories')
        .select('*')
        .eq('account_id', accountId)
        .order('name', { ascending: true });
      
      if (error) throw error;
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
      
      const { data, error } = await supabaseClient
        .from('reports')
        .select('*')
        .eq('account_id', accountId)
        .order('end_date', { ascending: false });
      
      if (error) throw error;
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
      const { error } = await supabaseClient
        .from('expenses')
        .update(data)
        .eq('id', id);
      
      if (error) throw error;
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
    onError: (error) => {
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
      const { data: result, error } = await supabaseClient
        .from('expenses')
        .insert(data)
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      notify('Expense created successfully', { type: 'success' });
    },
    onError: (error) => {
      notify(`Error creating expense: ${error.message}`, { type: 'error' });
    },
  });
};

export const useDeleteExpense = () => {
  const queryClient = useQueryClient();
  const notify = useNotify();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabaseClient
        .from('expenses')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      notify('Expense deleted successfully', { type: 'success' });
    },
    onError: (error) => {
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
      const { error } = await supabaseClient
        .from('expenses')
        .update(data)
        .eq('id', id);
      
      if (error) throw error;
      return { id, data };
    },
    onMutate: async ({ id, data }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['expenses'] });
      
      // Snapshot the previous value
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
    onError: (error, _variables, context) => {
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