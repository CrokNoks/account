
import React from 'react';
import { List, Datagrid, TextField, NumberField, DateField, useTranslate } from 'react-admin';

// Enhanced interfaces following TypeScript guidelines
interface ExpenseListProps {
  filter?: Record<string, any>;
  perPage?: number;
}

/**
 * Memoized Expense List Component
 * List all transactions with performance optimizations
 */
export const ExpenseList: React.FC<ExpenseListProps> = React.memo((props) => {
  const translate = useTranslate();
  
  return (
    <List 
      {...props}
      perPage={props.perPage || 25}
      sort={{ field: 'date', order: 'DESC' }}
    >
      <Datagrid 
        rowClick="edit"
        bulkActionButtons={false}
        sx={{
          '& .RaDatagrid-headerCell': {
            fontWeight: 'bold',
          },
        }}
      >
        <TextField 
          source="description" 
          label={translate('resources.transactions.fields.description')}
          sortable={true}
        />
        <DateField 
          source="date" 
          label={translate('resources.transactions.fields.date')}
          sortable={true}
          locales="fr-FR"
        />
        <TextField 
          source="category" 
          label={translate('resources.transactions.fields.category')}
          sortable={true}
        />
        <TextField 
          source="type" 
          label={translate('resources.transactions.fields.type')}
          sortable={false}
        />
        <NumberField
          source="amount"
          label={translate('resources.transactions.fields.amount')}
          options={{ style: 'currency', currency: 'EUR' }}
          sortable={true}
          textAlign="right"
        />
        <TextField 
          source="payment_method" 
          label={translate('resources.transactions.fields.payment_method')}
          sortable={true}
        />
        <TextField 
          source="reconciliation_status" 
          label={translate('resources.transactions.fields.reconciliation_status')}
          sortable={true}
        />
      </Datagrid>
    </List>
  );
});

ExpenseList.displayName = 'ExpenseList';