import { lazy, ComponentType } from 'react';

// Create a simple wrapper for lazy loading React Admin components
const lazyLoadRA = (importFunc: () => Promise<any>) => {
  return lazy(async () => {
    const module = await importFunc();
    // React Admin components are typically exported as named exports
    // We need to handle different export patterns
    const Component = module.default || Object.values(module)[0];
    return { default: Component };
  });
};

// Expense Resources
export const ExpenseList = lazyLoadRA(() => import('../resources/expenses/ExpenseList'));
export const ExpenseEdit = lazyLoadRA(() => import('../resources/expenses/ExpenseEdit'));
export const ExpenseCreate = lazyLoadRA(() => import('../resources/expenses/ExpenseCreate'));
export const ExpenseShow = lazyLoadRA(() => import('../resources/expenses/ExpenseShow'));

// Category Resources
export const CategoryList = lazyLoadRA(() => import('../resources/categories/CategoryList'));
export const CategoryEdit = lazyLoadRA(() => import('../resources/categories/CategoryEdit'));
export const CategoryCreate = lazyLoadRA(() => import('../resources/categories/CategoryCreate'));

// Account Resources
export const AccountList = lazyLoadRA(() => import('../resources/accounts/AccountList'));
export const AccountCreate = lazyLoadRA(() => import('../resources/accounts/AccountCreate'));
export const AccountEdit = lazyLoadRA(() => import('../resources/accounts/AccountEdit'));

// Report Resources
export const ReportDashboard = lazyLoadRA(() => import('../resources/reports/ReportDashboard'));
export const CategoryEvolution = lazyLoadRA(() => import('../resources/reports/CategoryEvolution'));

// Transfer Resources
export const TransferCreate = lazyLoadRA(() => import('../resources/transfers/TransferCreate'));

// Budget Template Resources
export const BudgetTemplateList = lazyLoadRA(() => import('../resources/budget-templates/BudgetTemplateList'));
export const BudgetTemplateCreate = lazyLoadRA(() => import('../resources/budget-templates/BudgetTemplateCreate'));
export const BudgetTemplateEdit = lazyLoadRA(() => import('../resources/budget-templates/BudgetTemplateEdit'));

// Period Resources
export const PeriodList = lazyLoadRA(() => import('../resources/periods/PeriodList'));
export const PeriodCreate = lazyLoadRA(() => import('../resources/periods/PeriodCreate'));
export const PeriodShow = lazyLoadRA(() => import('../resources/periods/PeriodShow'));

// Heavy/Feature-specific components
export const CategorizationModal = lazyLoadRA(() => import('../resources/expenses/CategorizationModal'));
export const ImportExpensesButton = lazyLoadRA(() => import('../resources/expenses/ImportExpensesButton'));
export const ImportCategoriesButton = lazyLoadRA(() => import('../resources/categories/ImportCategoriesButton'));

// Preload critical components
export const preloadCriticalComponents = () => {
  // Preload components that are likely to be accessed immediately
  import('../resources/expenses/ExpenseList');
  import('../resources/reports/ReportDashboard');
  import('../resources/categories/CategoryList');
};

// Preload components on interaction
export const preloadOnHover = (importFunc: () => Promise<any>) => {
  let preloaded = false;
  
  return () => {
    if (!preloaded) {
      preloaded = true;
      importFunc();
    }
  };
};

// Preload strategies
export const preloadStrategies = {
  // Preload when user is idle
  onIdle: (importFunc: () => Promise<any>) => {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        importFunc();
      });
    }
  },
  
  // Preload after initial render
  afterRender: (importFunc: () => Promise<any>) => {
    setTimeout(() => {
      importFunc();
    }, 2000);
  },
  
  // Preload on visibility change
  onVisible: (importFunc: () => Promise<any>) => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        importFunc();
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
  },
  
  // Preload on network connection quality
  onGoodConnection: (importFunc: () => Promise<any>) => {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      if (connection && (connection.effectiveType === '4g' || connection.downlink > 1.5)) {
        importFunc();
      }
    }
  }
};

// Export all lazy loaded resources
export const LazyResources = {
  // Expenses
  ExpenseList,
  ExpenseEdit,
  ExpenseCreate,
  ExpenseShow,
  
  // Categories
  CategoryList,
  CategoryEdit,
  CategoryCreate,
  
  // Accounts
  AccountList,
  AccountCreate,
  AccountEdit,
  
  // Reports
  ReportDashboard,
  CategoryEvolution,
  
  // Transfers
  TransferCreate,
  
  // Budget Templates
  BudgetTemplateList,
  BudgetTemplateCreate,
  BudgetTemplateEdit,
  
  // Periods
  PeriodList,
  PeriodCreate,
  PeriodShow,
  
  // Feature components
  CategorizationModal,
  ImportExpensesButton,
  ImportCategoriesButton,
};