import { Admin, Resource } from 'react-admin';
import { dataProvider } from './providers/dataProvider';
import { authProvider } from './providers/authProvider';
import { AccountProvider } from './context/AccountContext';
import { QueryProvider } from './providers/QueryProvider';
import { CustomLayout } from './Layout';

import { i18nProvider } from './i18nProvider';

// Import your resources
import { ExpenseList, ExpenseEdit, ExpenseCreate, ExpenseShow } from './resources/expenses';
import { CategoryList, CategoryEdit, CategoryCreate } from './resources/categories';
import { AccountList, AccountCreate, AccountEdit } from './resources/accounts';
import { ReportDashboard, CategoryEvolution } from './resources/reports';
import { TransferCreate } from './resources/transfers';
import { BudgetTemplateList, BudgetTemplateCreate, BudgetTemplateEdit } from './resources/budget-templates';
import { PeriodList, PeriodCreate, PeriodShow } from './resources/periods';
import { BudgetDashboard } from './resources/budgets';

// app_users est utilisé pour les listes de sélection (partage de comptes)

function App() {
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
        {/* Rapports */}
        <Resource
          name="reports"
          list={ReportDashboard}
          options={{ label: 'Rapports' }}
        />

        {/* Évolution par Catégorie */}
        <Resource
          name="category-evolution"
          list={CategoryEvolution}
          options={{ label: 'Évolution Catégories' }}
        />

        {/* Dépenses */}
        <Resource
          name="expenses"
          list={ExpenseList}
          edit={ExpenseEdit}
          create={ExpenseCreate}
          show={ExpenseShow}
        />

        {/* Catégories */}
        <Resource
          name="categories"
          list={CategoryList}
          edit={CategoryEdit}
          create={CategoryCreate}
        />

        {/* Comptes */}
        <Resource
          name="accounts"
          list={AccountList}
          edit={AccountEdit}
          create={AccountCreate}
        />

        {/* Virements */}
        <Resource
          name="transfers"
          create={TransferCreate}
          options={{ label: 'Virements' }}
        />

        {/* Utilisateurs (pour sélection) */}
        <Resource
          name="app_users"
          options={{ label: 'Utilisateurs' }}
        />

        {/* Périodes & Budgets (NestJS) */}
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
}

export default App;
