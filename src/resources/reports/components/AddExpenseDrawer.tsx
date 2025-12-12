import { Drawer, Box, Typography, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { CreateBase, EditBase, SimpleForm, TextInput, DateInput, ReferenceInput, SelectInput, BooleanInput, required } from 'react-admin';

interface AddExpenseDrawerProps {
  open: boolean;
  onClose: () => void;
  selectedAccountId: string;
  onSuccess: () => void;
  expenseId?: string | null;
}

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
            transform={(data: any) => ({ ...data, account_id: selectedAccountId, amount: Number(data.amount) })}
            mutationOptions={{ onSuccess }}
          >
            <SimpleForm>
              <TextInput source="description" label="Description" validate={[required()]} fullWidth />
              <TextInput
                source="amount"
                label="Montant"
                validate={[required(), (value) => (value && !/^-?\d*\.?\d*$/.test(value) ? 'Nombre invalide' : undefined)]}
                fullWidth
                inputProps={{ inputMode: 'text' }}
              />
              <DateInput source="date" label="Date" validate={[required()]} fullWidth />

              <ReferenceInput
                source="category_id"
                reference="categories"
                filter={{ account_id: selectedAccountId }}
                perPage={100}
                sort={{ field: 'name', order: 'ASC' }}
              >
                <SelectInput optionText="name" label="Catégorie" fullWidth />
              </ReferenceInput>

              <TextInput source="notes" label="Notes" multiline fullWidth />
              <BooleanInput source="reconciled" label="Pointé" />
            </SimpleForm>
          </EditBase>
        ) : (
          <CreateBase
            resource="expenses"
            transform={(data: any) => ({ ...data, account_id: selectedAccountId, amount: Number(data.amount) })}
            mutationOptions={{ onSuccess }}
          >
            <SimpleForm>
              <TextInput source="description" label="Description" validate={[required()]} fullWidth />
              <TextInput
                source="amount"
                label="Montant"
                validate={[required(), (value) => (value && !/^-?\d*\.?\d*$/.test(value) ? 'Nombre invalide' : undefined)]}
                fullWidth
                inputProps={{ inputMode: 'text' }}
              />
              <DateInput source="date" label="Date" validate={[required()]} defaultValue={new Date()} fullWidth />

              <ReferenceInput
                source="category_id"
                reference="categories"
                filter={{ account_id: selectedAccountId }}
                perPage={100}
                sort={{ field: 'name', order: 'ASC' }}
              >
                <SelectInput optionText="name" label="Catégorie" fullWidth />
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
