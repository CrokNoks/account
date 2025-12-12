import { Drawer, Box, Typography, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { EditBase, SimpleForm, TextInput, NumberInput, DateInput, ReferenceInput, AutocompleteInput, BooleanInput, required, Toolbar, SaveButton, DeleteButton, useTranslate } from 'react-admin';

interface EditExpenseDrawerProps {
  open: boolean;
  onClose: () => void;
  selectedAccountId: string;
  onSuccess: () => void;
  expenseId: string;
}

const EditToolbar = () => (
  <Toolbar>
    <SaveButton />
    <DeleteButton redirect={false} mutationOptions={{ onSuccess: () => window.location.reload() }} />
  </Toolbar>
);

export const EditExpenseDrawer = ({ open, onClose, selectedAccountId, onSuccess, expenseId }: EditExpenseDrawerProps) => {
  const translate = useTranslate();
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
    >
      <Box sx={{ width: { xs: '100%', sm: 400 }, p: 2 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">
            {translate('app.drawers.edit_expense')}
          </Typography>
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>

        {expenseId && (
          <EditBase
            resource="expenses"
            id={expenseId}
            redirect={false}
            mutationMode="optimistic"
            mutationOptions={{ onSuccess }}
          >
            <SimpleForm toolbar={<EditToolbar />}>
              <TextInput source="description" label="resources.expenses.fields.description" validate={[required()]} fullWidth />
              <NumberInput source="amount" label="resources.expenses.fields.amount" validate={[required()]} fullWidth />
              <DateInput source="date" label="resources.expenses.fields.date" validate={[required()]} fullWidth />

              <ReferenceInput
                source="category_id"
                reference="categories"
                filter={{ account_id: selectedAccountId }}
                perPage={100}
                sort={{ field: 'name', order: 'ASC' }}
              >
                <AutocompleteInput
                  optionText="name"
                  label="resources.expenses.fields.category_id"
                  filterToQuery={searchText => ({ name: searchText })}
                  fullWidth
                />
              </ReferenceInput>

              <TextInput source="notes" label="resources.expenses.fields.note" multiline fullWidth />
              <BooleanInput source="reconciled" label="resources.expenses.fields.reconciled" />
            </SimpleForm>
          </EditBase>
        )}
      </Box>
    </Drawer>
  );
};
