
import React, { useState, useCallback } from 'react';
import {
  List,
  Datagrid,
  TextField,
  DateField,
  NumberField,
  ReferenceField,
  EditButton,
  DeleteButton,
  useRecordContext,
  useTranslate,
  useResourceContext,
  SelectField,
  CreateButton,
  TextInput,
  ReferenceInput,
  SelectInput,
  DateInput,
  FilterList,
  FilterListItem,
  FilterLiveSearch,
  SavedQueriesList,
  FunctionField,
  SimpleList,
  NullableBooleanInput,
} from 'react-admin';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { Box, Card, CardContent, Switch, Tooltip, Typography, Button } from '@mui/material';
import { useAccount } from '../../context/AccountContext';
import { ImportExpensesButton } from './ImportExpensesButton';
import { useIsSmall } from '../../hooks/isSmall';
import { ImportCreateToolbar } from '../../components/ImportCreateToolbar';
import { AccountRequired } from '../../components/AccountRequired';
import { CategoryShip } from '../../components/CategoryShip';
import { CategorizationModal } from './CategorizationModal';
import { useExpenseActions } from './hooks/useExpenseActions';

// Hoist static choices array to avoid recreation
const PAYMENT_METHOD_CHOICES = [
  { id: 'credit_card', name: 'resources.expenses.fields.payment_methods.credit_card' },
  { id: 'direct_debit', name: 'resources.expenses.fields.payment_methods.direct_debit' },
  { id: 'transfer', name: 'resources.expenses.fields.payment_methods.transfer' },
  { id: 'check', name: 'resources.expenses.fields.payment_methods.check' },
  { id: 'cash', name: 'resources.expenses.fields.payment_methods.cash' },
  { id: 'other', name: 'resources.expenses.fields.payment_methods.other' },
];

const ReconciledToggle = React.memo(({ onSuccess, readOnly = false }: { onSuccess?: () => void, readOnly?: boolean }) => {
  const record = useRecordContext();
  const { toggleReconciled } = useExpenseActions();

  if (!record) return null;

  const handleToggle = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    if (readOnly) return;
    event.stopPropagation(); // Prevent row click
    toggleReconciled(record, onSuccess);
  }, [readOnly, record, toggleReconciled, onSuccess]);

  return (
    <Switch
      checked={record.reconciled || false}
      onChange={handleToggle}
      onClick={(e) => e.stopPropagation()} // Prevent row click
      color="primary"
      disabled={readOnly}
    />
  );
});

export const ExpenseFilterSidebar = () => {
  const translate = useTranslate();
  return (
    <Card sx={{ order: -1, mr: 2, mt: 9, width: 260 }}>
      <CardContent>
        <Typography variant="subtitle2" gutterBottom>
          {translate('app.expenses.filter.title')}
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={1}>
          {translate('app.expenses.filter.subtitle')}
        </Typography>
        <SavedQueriesList />
        <FilterLiveSearch />
        <FilterList label={translate('resources.expenses.fields.reconciled')} icon={<CheckCircleIcon />}>
          <FilterListItem label={translate('app.filters.reconciled.true')} value={{ reconciled: true }} />
          <FilterListItem label={translate('app.filters.reconciled.false')} value={{ reconciled: false }} />
        </FilterList>
      </CardContent>
    </Card>
  );
};

const ExpenseListEmpty = () => {
  const translate = useTranslate();
  const resource = useResourceContext();
  return (
    <Box textAlign="center" m={1} mt={4} data-testid="expense-list-empty">
      <Typography variant="body1" paragraph color="textSecondary">
        {translate('ra.page.empty', { name: resource })}
      </Typography>
      <Box mt={2} display="flex" justifyContent="center" gap={2}>
        <CreateButton />
        <ImportExpensesButton />
      </Box>
    </Box>
  );
};

export const ExpenseList = ({ filter, embed = false, actions = <></>, onRowClick, onUpdate, readOnly = false }: { filter: any, embed?: boolean, actions?: any, onRowClick?: (id: any) => false, onUpdate?: () => void, readOnly?: boolean }) => {
  const { selectedAccountId } = useAccount();
  const isSmall = useIsSmall();

  if (!selectedAccountId) {
    return <AccountRequired message="app.components.account_required.message" />;
  }

  return (
    <List
      resource='expenses'
      filter={{ account_id: selectedAccountId, ...filter }}
      sort={{ field: 'date', order: 'DESC' }}
      actions={embed ? actions : <ExpenseListActions />}
      filters={expenseFilters(selectedAccountId, embed)}
      filterDefaultValues={{ reconciled: undefined }}
      aside={embed ? undefined : <ExpenseFilterSidebar />}
      empty={embed ? false : <ExpenseListEmpty />}
    >

      {isSmall ? (
        <SimpleList
          rowClick={onRowClick || false}
          primaryText={(record) => record.description}
          secondaryText={(record) => new Date(record.date).toLocaleDateString()}
          tertiaryText={(record) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(record.amount)}
          leftIcon={(record) => record.reconciled ? <CheckCircleIcon color="success" /> : <CancelIcon color="error" />}
          sx={{
            '& .MuiListItem-root': {
              py: 0.5, // Reduced vertical padding
              '&:nth-of-type(odd)': {
                backgroundColor: 'action.hover', // Zebra striping
              },
            },
            '& .MuiListItemText-root': {
              my: 0
            }
          }}
        />
      ) : (
        <Datagrid {...(embed ? { bulkActionButtons: false, rowClick: onRowClick || false } : { rowClick: 'show' })}>
          <DateField source="date" label="resources.expenses.fields.date" />
          {embed ? (<FunctionField
            render={(record: any) => (
              <Tooltip title={record.description}>
                {record.description.slice(0, 20)}
              </Tooltip>
            )}
          />) : (
            <TextField source="description" label="resources.expenses.fields.description" />)}
          <ReferenceField source="category_id" reference="categories" label="resources.expenses.fields.category_id">
            <FunctionField
              render={(record: any) => (
                <CategoryShip cat={record} />
              )}
            />
          </ReferenceField>
          <NumberField
            source="amount"
            label="resources.expenses.fields.amount"
            options={{ style: 'currency', currency: 'EUR' }}
          />
          <SelectField
            source="payment_method"
            label="resources.expenses.fields.payment_method"
            choices={PAYMENT_METHOD_CHOICES}
          />
          <FunctionField label="resources.expenses.fields.reconciled" render={() => <ReconciledToggle onSuccess={onUpdate} readOnly={readOnly} />} />
          {embed && readOnly ? <></> : embed ? <></> : <EditButton />}
          {embed && readOnly ? <></> : embed ? <></> : <DeleteButton />}
        </Datagrid>)}
    </List>
  );
};
