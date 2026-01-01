import { List, Datagrid, DateField, BooleanField, Loading } from 'react-admin';
import { useAccount } from '../../context/AccountContext';

export const PeriodList = () => {
  const { selectedAccountId } = useAccount();

  if (!selectedAccountId) return <Loading />;

  return (
    <List
      sort={{ field: 'start_date', order: 'DESC' }}
      filter={{ account_id: selectedAccountId }}
    >
      <Datagrid rowClick="show">
        <DateField source="start_date" label="Début" />
        <DateField source="end_date" label="Fin" />
        <DateField source="estimated_end_date" label="Fin Estimée" />
        <BooleanField source="is_active" label="Actif" />
      </Datagrid>
    </List>
  );
};
