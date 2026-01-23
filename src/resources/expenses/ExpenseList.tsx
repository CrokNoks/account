
import { List, Datagrid, TextField, NumberField, DateField, useTranslate } from 'react-admin'

interface ExpenseListProps {
  filter?: any
  perPage?: number
}

/**
 * Expense List Component
 * List all transactions - backward compatibility wrapper
 */
export const ExpenseList = (props: ExpenseListProps) => {
  const translate = useTranslate()
  
  return (
    <List {...props}>
      <Datagrid>
        <TextField source="description" label={translate('resources.transactions.fields.description')} />
        <DateField source="date" label={translate('resources.transactions.fields.date')} />
        <TextField source="category" label={translate('resources.transactions.fields.category')} />
        <TextField source="type" label={translate('resources.transactions.fields.type')} />
        <NumberField
          source="amount"
          label={translate('resources.transactions.fields.amount')}
          options={{ style: 'currency', currency: 'EUR' }}
        />
        <TextField source="payment_method" label={translate('resources.transactions.fields.payment_method')} />
        <TextField source="reconciliation_status" label={translate('resources.transactions.fields.reconciliation_status')} />
      </Datagrid>
    </List>
  );
};