
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
} from 'react-admin';
import {
  TopToolbar,
  CreateButton,
  TextInput,
  ReferenceInput,
  SelectInput,
  DateInput, FilterList, FilterListItem, FilterLiveSearch, SavedQueriesList, FunctionField,
  SimpleList,
  NullableBooleanInput
} from 'ra-ui-materialui';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { Card, CardContent, Switch } from '@mui/material';
import { useAccount } from '../../context/AccountContext';
import { ImportExpensesButton } from './ImportExpensesButton';
import { useIsSmall } from '../../hooks/isSmall';

const ExpenseListActions = () => (
  <TopToolbar>
    <ImportExpensesButton />
    <CreateButton />
  </TopToolbar>
);

const expenseFilters = (selectedAccountId: string | null, embed: boolean = false) => {
  const defaultProps = embed ? {} : { alwaysOn: true };
  return [
    <TextInput source="description" label="Description" {...defaultProps} />,
    <ReferenceInput
      source="category_id"
      reference="categories"
      label="Catégorie"
      filter={{ account_id: selectedAccountId }}
      {...defaultProps}
    >
      <SelectInput optionText="name" />
    </ReferenceInput>,
    <DateInput source="date_gte" label="Date début"  {...defaultProps} />,
    <DateInput source="date_lte" label="Date fin" {...defaultProps} />,

    <NullableBooleanInput nullLabel="Tous" trueLabel="Pointé" falseLabel="Non pointé" source="reconciled" label="Pointé" {...defaultProps} {...(embed ? { alwaysOn: true } : {})} />,
  ]
};

const ReconciledToggle = () => {
  const record = useRecordContext();
  const notify = useNotify();
  const [update] = useUpdate();
  const refresh = useRefresh();

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
      notify('Statut mis à jour', { type: 'success' });
    } catch (error) {
      notify('Erreur lors de la mise à jour', { type: 'error' });
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

export const ExpenseFilterSidebar = () => (
  <Card sx={{ order: -1, mr: 2, mt: 9, width: 200 }}>
    <CardContent>
      <SavedQueriesList />
      <FilterLiveSearch />
      <FilterList label="Pointé" icon={<CheckCircleIcon />}>
        <FilterListItem label="Oui" value={{ reconciled: true }} />
        <FilterListItem label="Non" value={{ reconciled: false }} />
      </FilterList>
    </CardContent>
  </Card>
);

export const ExpenseList = ({ filter, embed = false, actions = <></> }: { filter: any, embed?: boolean, actions?: any } = { filter: {} }) => {
  const { selectedAccountId } = useAccount();
  const isSmall = useIsSmall();

  if (!selectedAccountId) {
    return (
      <List>
        <div>Veuillez sélectionner un compte pour voir les dépenses.</div>
      </List>
    );
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
          rowClick={false}
          primaryText={(record) => record.description}
          secondaryText={(record) => new Date(record.date).toLocaleDateString()}
          tertiaryText={(record) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(record.amount)}
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
        <Datagrid {...(embed ? { bulkActionButtons: false, rowClick: false } : { rowClick: 'edit' })}>
          <DateField source="date" label="Date" />
          <TextField source="description" label="Description" />
          <ReferenceField source="category_id" reference="categories" label="Catégorie">
            <FunctionField
              render={(record: any) => (
                <TextField source="name" sx={{ color: 'text.primary', backgroundColor: record.color, padding: 1, borderRadius: 1 }} />
              )}
            />
          </ReferenceField>
          <NumberField
            source="amount"
            label="Montant"
            options={{ style: 'currency', currency: 'EUR' }}
          />
          <FunctionField label="Pointé" render={() => <ReconciledToggle />} />
          {embed ? <></> : <EditButton />}
          {embed ? <></> : <DeleteButton />}
        </Datagrid>)}
    </List>
  );
};
