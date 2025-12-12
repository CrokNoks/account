
import {
  List,
  Datagrid,
  TextField,
  DateField,
  NumberField,
  ReferenceField,
  EditButton,
  DeleteButton,
  useUpdate,
  useRecordContext,
  useNotify,
  useRefresh,
  useTranslate,
} from 'react-admin';
import {
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
} from 'ra-ui-materialui';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import { Card, CardContent, Switch, Typography } from '@mui/material';
import { useAccount } from '../../context/AccountContext';
import { ImportExpensesButton } from './ImportExpensesButton';
import { useIsSmall } from '../../hooks/isSmall';
import { ImportCreateToolbar } from '../../components/ImportCreateToolbar';
import { AccountRequired } from '../../components/AccountRequired';
import { CategoryShip } from '../../components/CategoryShip';

const ExpenseListActions = () => (
  <ImportCreateToolbar importButton={<ImportExpensesButton />} />
);

const expenseFilters = (selectedAccountId: string | null, embed: boolean = false) => {
  const defaultProps = embed ? {} : { alwaysOn: true };
  return [
    <TextInput source="description" label="resources.expenses.fields.description" {...defaultProps} />,
    <ReferenceInput
      source="category_id"
      reference="categories"
      label="resources.expenses.fields.category_id"
      filter={{ account_id: selectedAccountId }}
      {...defaultProps}
    >
      <SelectInput optionText="name" />
    </ReferenceInput>,
    <DateInput source="date_gte" label="app.filters.date_gte"  {...defaultProps} />,
    <DateInput source="date_lte" label="app.filters.date_lte" {...defaultProps} />,

    <NullableBooleanInput nullLabel="app.filters.reconciled.all" trueLabel="app.filters.reconciled.true" falseLabel="app.filters.reconciled.false" source="reconciled" label="resources.expenses.fields.reconciled" {...defaultProps} {...(embed ? { alwaysOn: true } : {})} />,
  ]
};

const ReconciledToggle = () => {
  const record = useRecordContext();
  const notify = useNotify();
  const [update] = useUpdate();
  const refresh = useRefresh();
  const translate = useTranslate();

  if (!record) return null;

  const handleToggle = async (event: React.ChangeEvent<HTMLInputElement>) => {
    event.stopPropagation(); // Prevent row click
    const newValue = event.target.checked;

    try {
      await update(
        'expenses',
        { id: record.id, data: { reconciled: newValue }, previousData: record }
      );
      await refresh();
      notify(translate('app.expenses.notifications.status_updated'), { type: 'success' });
    } catch (error) {
      notify(translate('app.expenses.notifications.update_error'), { type: 'error' });
    }
  };

  return (
    <Switch
      checked={record.reconciled || false}
      onChange={handleToggle}
      onClick={(e) => e.stopPropagation()} // Prevent row click
      color="primary"
    />
  );
};

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

export const ExpenseList = ({ filter, embed = false, actions = <></>, onRowClick }: { filter: any, embed?: boolean, actions?: any, onRowClick?: (id: any) => false }) => {
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
      {...(embed ? { empty: false } : {})}
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
        <Datagrid {...(embed ? { bulkActionButtons: false, rowClick: onRowClick || false } : { rowClick: 'edit' })}>
          <DateField source="date" label="resources.expenses.fields.date" />
          <TextField source="description" label="resources.expenses.fields.description" />
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
          <FunctionField label="resources.expenses.fields.reconciled" render={() => <ReconciledToggle />} />
          {embed ? <></> : <EditButton />}
          {embed ? <></> : <DeleteButton />}
        </Datagrid>)}
    </List>
  );
};
