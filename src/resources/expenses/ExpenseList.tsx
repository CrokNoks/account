
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

const ExpenseListActions = () => (
  <ImportCreateToolbar importButton={<ImportExpensesButton />} />
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
  <Card sx={{ order: -1, mr: 2, mt: 9, width: 260 }}>
    <CardContent>
      <Typography variant="subtitle2" gutterBottom>
        Filtres des opérations
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={1}>
        Affinez l&apos;affichage par texte, période et statut de pointage.
      </Typography>
      <SavedQueriesList />
      <FilterLiveSearch />
      <FilterList label="Pointé" icon={<CheckCircleIcon />}>
        <FilterListItem label="Oui (pointé)" value={{ reconciled: true }} />
        <FilterListItem label="Non pointé" value={{ reconciled: false }} />
      </FilterList>
    </CardContent>
  </Card>
);

export const ExpenseList = ({ filter, embed = false, actions = <></>, onRowClick }: { filter: any, embed?: boolean, actions?: any, onRowClick?: (id: any) => false }) => {
  const { selectedAccountId } = useAccount();
  const isSmall = useIsSmall();

  if (!selectedAccountId) {
    return <AccountRequired message="Veuillez sélectionner un compte pour voir les dépenses." />;
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
          leftIcon={(record) => record.reconciled ? <CheckCircleIcon color="success" /> : <CancelIcon color="error" />}
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
        <Datagrid {...(embed ? { bulkActionButtons: false, rowClick: onRowClick || false } : { rowClick: 'edit' })}>
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
