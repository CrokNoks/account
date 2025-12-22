import {
  Show,
  SimpleShowLayout,
  TextField,
  NumberField,
  DateField,
  ReferenceField,
  BooleanField,
  FunctionField,
  SelectField,
} from 'react-admin';
import { CategoryShip } from '../../components/CategoryShip';

export const ExpenseShow = () => {
  return (
    <Show>
      <SimpleShowLayout>
        <TextField source="description" label="resources.expenses.fields.description" />
        <NumberField
          source="amount"
          label="resources.expenses.fields.amount"
          options={{ style: 'currency', currency: 'EUR' }}
        />
        <DateField source="date" label="resources.expenses.fields.date" />

        <ReferenceField source="category_id" reference="categories" label="resources.expenses.fields.category_id">
          <FunctionField
            render={(record: any) => (
              <CategoryShip cat={record} />
            )}
          />
        </ReferenceField>

        <TextField source="notes" label="resources.expenses.fields.note" />

        <SelectField
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
        />

        <BooleanField source="reconciled" label="resources.expenses.fields.reconciled" />

        {/* Display Metadata for debugging or info */}
        <FunctionField
          label="Metadata"
          render={(record: any) => {
            if (!record.metadata) return null;
            return (
              <pre style={{ fontSize: '0.8em', backgroundColor: '#f5f5f5', padding: '10px', borderRadius: '4px' }}>
                {JSON.stringify(record.metadata, null, 2)}
              </pre>
            );
          }}
        />
      </SimpleShowLayout>
    </Show>
  );
};
