import {
  Edit,
  SimpleForm,
  TextInput,
  required
} from 'react-admin';
import { AccountSharesManager } from './AccountSharesManager';

export const AccountEdit = () => {


  return (
    <Edit>
      <SimpleForm>
        <TextInput source="name" label="resources.accounts.fields.name" validate={[required()]} fullWidth />

        <TextInput
          source="initial_balance"
          label="resources.accounts.fields.initial_balance"
          helperText="resources.accounts.fields.initial_balance_helper"
          type="number"
          fullWidth
        />
        <AccountSharesManager />
      </SimpleForm>
    </Edit>
  );
};
