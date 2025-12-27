import {
  SimpleForm,
  TextInput,
  DateInput,
  ReferenceInput,
  AutocompleteInput,
  BooleanInput,
  required,
  SelectInput,
} from 'react-admin';

export const ExpenseForm = (props: any) => {
  const { selectedAccountId, toolbar, ...rest } = props;

  return (
    <SimpleForm toolbar={toolbar} {...rest}>
      <TextInput source="description" label="resources.expenses.fields.description" validate={[required()]} fullWidth />
      <TextInput
        source="amount"
        label="resources.expenses.fields.amount"
        validate={[required(), (value) => (value && !/^-?\d*[.,]?\d*$/.test(value) ? 'Nombre invalide' : undefined)]}
        inputProps={{ inputMode: 'decimal' }}
        fullWidth
      />
      <DateInput source="date" label="resources.expenses.fields.date" validate={[required()]} fullWidth />

      <ReferenceInput source="category_id" reference="categories" filter={{ account_id: selectedAccountId }} perPage={100} sort={{ field: 'name', order: 'ASC' }}>
        <AutocompleteInput optionText="name" label="resources.expenses.fields.category_id" filterToQuery={searchText => ({ name: searchText })} fullWidth />
      </ReferenceInput>

      <TextInput source="notes" label="resources.expenses.fields.note" multiline fullWidth />

      <SelectInput
        source="payment_method"
        label="resources.expenses.fields.payment_method"
        choices={[
          { id: 'credit_card', name: 'resources.expenses.fields.payment_methods.credit_card' },
          { id: 'direct_debit', name: 'resources.expenses.fields.payment_methods.direct_debit' },
          { id: 'transfer', name: 'resources.expenses.fields.payment_methods.transfer' },
          { id: 'check', name: 'resources.expenses.fields.payment_methods.check' },
          { id: 'cash', name: 'resources.expenses.fields.payment_methods.cash' },
          { id: 'other', name: 'resources.expenses.fields.payment_methods.other' },
        ]}
        fullWidth
      />

      <BooleanInput source="reconciled" label="resources.expenses.fields.reconciled" />
    </SimpleForm>
  );
};
