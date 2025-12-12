import { List, Datagrid, TextField, DateField, EditButton, NumberField, DeleteButton } from 'react-admin';
import { SimpleList } from 'ra-ui-materialui';
import { useIsSmall } from '../../hooks/isSmall';

export const AccountList = () => {
  const isSmall = useIsSmall();

  return (
    <List>
      {isSmall ? (
        <SimpleList
          primaryText={(record) => record.name}
          secondaryText={(record) =>
            record.created_at
              ? new Date(record.created_at).toLocaleDateString('fr-FR')
              : ''
          }
          tertiaryText={(record) =>
            new Intl.NumberFormat('fr-FR', {
              style: 'currency',
              currency: 'EUR',
            }).format(record.initial_balance || 0)
          }
        />
      ) : (
        <Datagrid rowClick="edit">
          <TextField source="name" label="resources.accounts.fields.name" />
          <DateField source="created_at" label="resources.accounts.fields.created_at" />
          <NumberField
            source="initial_balance"
            label="resources.accounts.fields.initial_balance"
            options={{ style: 'currency', currency: 'EUR' }}
          />
          <EditButton />
          <DeleteButton />
        </Datagrid>
      )}
    </List>
  );
};

