import { Admin, Resource } from 'react-admin';
import { dataProvider } from './providers/dataProvider';
import { authProvider } from './providers/authProvider';
import { AccountProvider } from './context/AccountContext';
import { CustomLayout } from './Layout';
import { lightTheme, darkTheme } from './theme';

// Import your resources
import { ExpenseList, ExpenseEdit, ExpenseCreate } from './resources/expenses';
import { CategoryList, CategoryEdit, CategoryCreate } from './resources/categories';
import { AccountList, AccountCreate, AccountEdit } from './resources/accounts';
import { ReportDashboard, CategoryEvolution } from './resources/reports';
import { TransferCreate } from './resources/transfers';
// app_users est utilisé pour les listes de sélection (partage de comptes)

function App() {
  return (
    <AccountProvider>
      <Admin
        dataProvider={dataProvider}
        authProvider={authProvider}
        layout={CustomLayout}
        theme={lightTheme}
        darkTheme={darkTheme}
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
      </Admin>
    </AccountProvider>
  );
}

export default App;
