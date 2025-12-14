import {
  Edit,
  SimpleForm,
  TextInput,
  NumberInput,
  DateInput,
  ReferenceInput,
  AutocompleteInput,
  required,
  BooleanInput,
} from 'react-admin';
import { useAccount } from '../../context/AccountContext';

export const ExpenseEdit = () => {
  const { selectedAccountId } = useAccount();

  return (
    <Edit>
      <SimpleForm>
        <TextInput source="description" label="resources.expenses.fields.description" validate={[required()]} fullWidth />
        <NumberInput source="amount" label="resources.expenses.fields.amount" validate={[required()]} />
        <DateInput source="date" label="resources.expenses.fields.date" validate={[required()]} />

        <ReferenceInput source="category_id" reference="categories" filter={{ account_id: selectedAccountId }}>
          <AutocompleteInput optionText="name" label="resources.expenses.fields.category_id" filterToQuery={searchText => ({ name: searchText })} />
        </ReferenceInput>

        <TextInput source="notes" label="resources.expenses.fields.note" multiline fullWidth />
        <BooleanInput source="reconciled" label="resources.expenses.fields.reconciled" />
      </SimpleForm>
    </Edit>
  );
};
