import { useCallback, useMemo } from 'react';
import { useGetList } from 'react-admin';
import { useAccount } from '../../../context/AccountContext';

export interface BudgetTracking {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  budgeted: number;
  spent: number;
  remaining: number;
  percentage: number;
  type: 'expense' | 'income' | 'savings' | 'transfer';
  isOverBudget: boolean;
  status: 'success' | 'warning' | 'error' | 'info';
  trend?: 'up' | 'down' | 'stable';
}

export interface BudgetAnalytics {
  totalBudgeted: number;
  totalSpent: number;
  totalRemaining: number;
  averageUtilization: number;
  overBudgetCount: number;
  warningCount: number;
  successCount: number;
  topOverBudgetCategories: BudgetTracking[];
  mostEfficientCategories: BudgetTracking[];
}

export const useBudgetTracking = (periodId: string | null) => {
  const { selectedAccountId } = useAccount();
  
  // Get budget templates
  const { data: budgetTemplates, isLoading: templatesLoading } = useGetList('budget-templates', {
    filter: { account_id: selectedAccountId },
    pagination: { page: 1, perPage: 100 }
  });

  // Get expenses for the period (if we have period data)
  const { data: expenses, isLoading: expensesLoading } = useGetList('expenses', {
    filter: periodId ? {
      date_gte: new Date().toISOString(), // This would need actual period dates
      date_lte: new Date().toISOString()
    } : {},
    pagination: { page: 1, perPage: 1000 }
  });

  const calculateBudgetTracking = useCallback((): BudgetTracking[] => {
    if (!budgetTemplates) return [];

    return budgetTemplates.map(template => {
      const categoryExpenses = expenses?.filter(expense => expense.category_id === template.category_id) || [];
      const spent = Math.abs(categoryExpenses.reduce((sum, expense) => sum + Number(expense.amount), 0));
      const percentage = template.amount_base > 0 ? Math.round((spent / template.amount_base) * 100) : 0;
      const remaining = template.amount_base - spent;
      
      let status: 'success' | 'warning' | 'error' | 'info';
      if (percentage >= 100) {
        status = 'error';
      } else if (percentage >= 80) {
        status = 'warning';
      } else if (percentage >= 50) {
        status = 'success';
      } else {
        status = 'info';
      }

      return {
        categoryId: template.category_id,
        categoryName: '', // This would need category join
        categoryColor: '#000000', // Default
        budgeted: template.amount_base,
        spent,
        remaining,
        percentage,
        type: template.is_fixed ? 'expense' : 'expense', // This would need category data
        isOverBudget: percentage >= 100,
        status
      };
    });
  }, [budgetTemplates, expenses]);

  const budgetTracking = useMemo(() => calculateBudgetTracking(), [calculateBudgetTracking]);

  const analytics = useMemo((): BudgetAnalytics => {
    const totalBudgeted = budgetTracking.reduce((sum, item) => sum + item.budgeted, 0);
    const totalSpent = budgetTracking.reduce((sum, item) => sum + item.spent, 0);
    const totalRemaining = totalBudgeted - totalSpent;
    const averageUtilization = totalBudgeted > 0 ? Math.round((totalSpent / totalBudgeted) * 100) : 0;
    
    const overBudgetCount = budgetTracking.filter(item => item.isOverBudget).length;
    const warningCount = budgetTracking.filter(item => item.status === 'warning').length;
    const successCount = budgetTracking.filter(item => item.status === 'success').length;
    
    const topOverBudgetCategories = budgetTracking
      .filter(item => item.isOverBudget)
      .sort((a, b) => (b.percentage - 100) - (a.percentage - 100))
      .slice(0, 5);
    
    const mostEfficientCategories = budgetTracking
      .filter(item => item.percentage < 50 && item.budgeted > 0)
      .sort((a, b) => a.percentage - b.percentage)
      .slice(0, 5);

    return {
      totalBudgeted,
      totalSpent,
      totalRemaining,
      averageUtilization,
      overBudgetCount,
      warningCount,
      successCount,
      topOverBudgetCategories,
      mostEfficientCategories
    };
  }, [budgetTracking]);

  const getBudgetStatus = useCallback((percentage: number, type: string) => {
    if (percentage >= 100) return { status: 'error', isOverBudget: true };
    if (percentage >= 80) return { status: 'warning', isOverBudget: false };
    if (type === 'income') {
      if (percentage >= 100) return { status: 'success', isOverBudget: false };
      if (percentage >= 50) return { status: 'info', isOverBudget: false };
    }
    return { status: 'success', isOverBudget: false };
  }, []);

  const formatCurrency = useCallback((amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  }, []);

  return {
    budgetTracking,
    analytics,
    isLoading: templatesLoading || expensesLoading,
    getBudgetStatus,
    formatCurrency,
    refetch: () => {} // This would trigger refetch of both queries
  };
};