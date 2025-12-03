import { List, Datagrid, TextField, DateField, EditButton, NumberField } from 'react-admin';

export const AccountList = () => (
    <List>
        <Datagrid rowClick="edit">
            <TextField source="name" label="Nom du compte" />
      <DateField source="created_at" label="Créé le" />
      <NumberField source="initial_balance" label="Solde initial" options={{ style: 'currency', currency: 'EUR' }} />
            <EditButton />
        </Datagrid>
    </List>
);
