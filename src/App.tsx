import React from 'react';
import { Admin, Resource } from 'react-admin';
import { dataProvider } from './providers/dataProvider';
import { authProvider } from './providers/authProvider';
import { AccountProvider } from './context/AccountContext';
import { QueryProvider } from './providers/QueryProvider';
import { CustomLayout } from './Layout';
import { i18nProvider } from './i18nProvider';

// Import resources following path alias guidelines
import { ExpenseList, ExpenseEdit, ExpenseCreate, ExpenseShow } from './resources/expenses';
import { CategoryList, CategoryEdit, CategoryCreate } from './resources/categories';
import { AccountList, AccountCreate, AccountEdit } from './resources/accounts';
import { ReportDashboard, CategoryEvolution } from './resources/reports';
import { TransferCreate } from './resources/transfers';
import { BudgetTemplateList, BudgetTemplateCreate, BudgetTemplateEdit } from './resources/budget-templates';
import { PeriodList, PeriodCreate, PeriodShow } from './resources/periods';
import { BudgetDashboard } from './resources/budgets';

// App component interface following TypeScript guidelines
interface AppProps {
  // Add any future props here
}

// Memoized App component following performance guidelines
const App: React.FC<AppProps> = () => {
  return (
    <QueryProvider>
      <AccountProvider>
        <Admin
          dataProvider={dataProvider}
          authProvider={authProvider}
          i18nProvider={i18nProvider}
          layout={CustomLayout}
          requireAuth
        >
          {/* Reporting Resources */}
          <Resource
            name="reports"
            list={ReportDashboard}
            options={{ label: 'Rapports' }}
          />
          <Resource
            name="category-evolution"
            list={CategoryEvolution}
            options={{ label: 'Évolution Catégories' }}
          />

          {/* Core Financial Resources */}
          <Resource
            name="expenses"
            list={ExpenseList}
            edit={ExpenseEdit}
            create={ExpenseCreate}
            show={ExpenseShow}
          />
          <Resource
            name="categories"
            list={CategoryList}
            edit={CategoryEdit}
            create={CategoryCreate}
          />
          <Resource
            name="accounts"
            list={AccountList}
            edit={AccountEdit}
            create={AccountCreate}
          />

          {/* Transaction Management */}
          <Resource
            name="transfers"
            create={TransferCreate}
            options={{ label: 'Virements' }}
          />

          {/* System Resources (for selection) */}
          <Resource
            name="app_users"
            options={{ label: 'Utilisateurs' }}
          />

          {/* Budget Management Resources */}
          <Resource
            name="periods"
            list={PeriodList}
            create={PeriodCreate}
            show={PeriodShow}
            options={{ label: 'Périodes' }}
          />
          <Resource
            name="budget-templates"
            list={BudgetTemplateList}
            create={BudgetTemplateCreate}
            edit={BudgetTemplateEdit}
            options={{ label: 'Modèles de Budget' }}
          />
          <Resource
            name="budgets"
            list={BudgetDashboard}
            options={{ label: 'Tableau de Bord Budgétaire' }}
          />
        </Admin>
      </AccountProvider>
    </QueryProvider>
  );
};

export default App;
