import {
  Create,
  SimpleForm,
  TextInput,
  NumberInput,
  DateInput,
  ReferenceInput,
  AutocompleteInput,
  required,
  BooleanInput,
  useRedirect,
} from 'react-admin';
import { useAccount } from '../../context/AccountContext';
import { AccountRequired } from '../../components/AccountRequired';

export const ExpenseCreate = () => {
  const { selectedAccountId } = useAccount();
  const redirect = useRedirect();

  const transform = (data: any) => ({
    ...data,
    account_id: selectedAccountId,
  });

  if (!selectedAccountId) {
    return <div><AccountRequired message="app.components.account_required.message" /></div>;
  }

  return (
    <Create
      transform={transform}
      mutationOptions={{
        onSuccess: () => {
          redirect('/reports');
        },
      }}
    >
      <SimpleForm>
        <TextInput source="description" label="resources.expenses.fields.description" validate={[required()]} fullWidth />
        <NumberInput source="amount" label="resources.expenses.fields.amount" validate={[required()]} />
        <DateInput source="date" label="resources.expenses.fields.date" validate={[required()]} defaultValue={new Date()} />

        <ReferenceInput source="category_id" reference="categories" filter={{ account_id: selectedAccountId }}>
          <AutocompleteInput optionText="name" label="resources.expenses.fields.category_id" filterToQuery={searchText => ({ name: searchText })} />
        </ReferenceInput>

        <TextInput source="notes" label="resources.expenses.fields.note" multiline fullWidth />
        <BooleanInput source="reconciled" label="resources.expenses.fields.reconciled" defaultValue={false} />
      </SimpleForm>
    </Create>
  );
};
