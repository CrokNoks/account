import { Drawer, Box, Typography, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { CreateBase, EditBase, SimpleForm, TextInput, NumberInput, DateInput, ReferenceInput, AutocompleteInput, BooleanInput, required, Toolbar, SaveButton, DeleteButton } from 'react-admin';

interface AddExpenseDrawerProps {
  open: boolean;
  onClose: () => void;
  selectedAccountId: string;
  onSuccess: () => void;
  expenseId?: string | null;
}

const EditToolbar = () => (
  <Toolbar>
    <SaveButton />
    <DeleteButton redirect={false} mutationOptions={{ onSuccess: () => window.location.reload() }} />
  </Toolbar>
);

export const AddExpenseDrawer = ({ open, onClose, selectedAccountId, onSuccess, expenseId }: AddExpenseDrawerProps) => {
  const isEdit = !!expenseId;

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
    >
      <Box sx={{ width: { xs: '100vw', sm: 400 }, p: 2 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">
            {isEdit ? 'Modifier l\'opération' : 'Ajouter une opération'}
          </Typography>
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>
        {isEdit ? (
          <EditBase
            resource="expenses"
            id={expenseId}
            redirect={false}
            mutationMode="optimistic"
            mutationOptions={{ onSuccess }}
          >
            <SimpleForm toolbar={<EditToolbar />}>
              <TextInput source="description" label="Description" validate={[required()]} fullWidth />
              <NumberInput source="amount" label="Montant" validate={[required()]} fullWidth />
              <DateInput source="date" label="Date" validate={[required()]} fullWidth />

              <ReferenceInput
                source="category_id"
                reference="categories"
                filter={{ account_id: selectedAccountId }}
                perPage={100}
                sort={{ field: 'name', order: 'ASC' }}
              >
                <AutocompleteInput
                  optionText="name"
                  label="Catégorie"
                  filterToQuery={searchText => ({ name: searchText })}
                  fullWidth
                />
              </ReferenceInput>

              <TextInput source="notes" label="Notes" multiline fullWidth />
              <BooleanInput source="reconciled" label="Pointé" />
            </SimpleForm>
          </EditBase>
        ) : (
          <CreateBase
            resource="expenses"
            transform={(data: any) => ({ ...data, account_id: selectedAccountId })}
            redirect={false}
            mutationOptions={{ onSuccess }}
          >
            <SimpleForm>
              <TextInput source="description" label="Description" validate={[required()]} fullWidth />
              <NumberInput source="amount" label="Montant" validate={[required()]} fullWidth />
              <DateInput source="date" label="Date" validate={[required()]} defaultValue={new Date()} fullWidth />

              <ReferenceInput
                source="category_id"
                reference="categories"
                filter={{ account_id: selectedAccountId }}
                perPage={100}
                sort={{ field: 'name', order: 'ASC' }}
              >
                <AutocompleteInput
                  optionText="name"
                  label="Catégorie"
                  filterToQuery={searchText => ({ name: searchText })}
                  fullWidth
                />
              </ReferenceInput>

              <TextInput source="notes" label="Notes" multiline fullWidth />
              <BooleanInput source="reconciled" label="Pointé" defaultValue={false} />
            </SimpleForm>
          </CreateBase>
        )}
      </Box>
    </Drawer>
  );
};
