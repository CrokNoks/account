import { List, Datagrid, TextField, BooleanField, NumberField, ReferenceField, Loading } from 'react-admin';
import { useAccount } from '../../context/AccountContext';

export const BudgetTemplateList = () => {
  const { selectedAccountId } = useAccount();

  if (!selectedAccountId) return <Loading />;

  return (
    <List
      sort={{ field: 'start_date', order: 'DESC' }}
      filter={{ account_id: selectedAccountId }}
    >
      <Datagrid rowClick="edit">
        <ReferenceField source="category_id" reference="categories">
          <TextField source="name" />
        </ReferenceField>
        <NumberField source="amount_base" options={{ style: 'currency', currency: 'EUR' }} label="Montant Base" />
        <BooleanField source="is_fixed" label="Fixe ?" />
      </Datagrid>
    </List>
  );
};
