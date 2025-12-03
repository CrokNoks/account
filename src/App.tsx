import { Admin, Resource } from 'react-admin';
import { dataProvider } from './providers/dataProvider';
import { authProvider } from './providers/authProvider';
import { AccountProvider } from './context/AccountContext';
import { CustomLayout } from './Layout';

// Import your resources
import { ExpenseList, ExpenseEdit, ExpenseCreate } from './resources/expenses';
import { CategoryList, CategoryEdit, CategoryCreate } from './resources/categories';
import { AccountList, AccountCreate, AccountEdit } from './resources/accounts';
import { ReportDashboard, CategoryEvolution } from './resources/reports';

function App() {
  return (
    <AccountProvider>
      <Admin
        dataProvider={dataProvider}
        authProvider={authProvider}
        layout={CustomLayout}
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
      </Admin>
    </AccountProvider>
  );
}

export default App;
