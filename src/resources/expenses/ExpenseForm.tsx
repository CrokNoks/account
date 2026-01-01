import {
  SimpleForm,
  TextInput,
  DateInput,
  BooleanInput,
  required,
  SelectInput,
} from 'react-admin';
import { SmartCategoryInput } from './components/SmartCategoryInput';

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

      <SmartCategoryInput source="category_id" selectedAccountId={selectedAccountId} />

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
