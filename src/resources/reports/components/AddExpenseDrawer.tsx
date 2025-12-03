import { Drawer, Box, Typography, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { CreateBase, SimpleForm, TextInput, NumberInput, DateInput, ReferenceInput, SelectInput, BooleanInput, required } from 'react-admin';

interface AddExpenseDrawerProps {
  open: boolean;
  onClose: () => void;
  selectedAccountId: string;
  onSuccess: () => void;
}

export const AddExpenseDrawer = ({ open, onClose, selectedAccountId, onSuccess }: AddExpenseDrawerProps) => {
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
    >
      <Box sx={{ width: { xs: '100vw', sm: 400 }, p: 2 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">
            Ajouter une opération
          </Typography>
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>
        <CreateBase
          resource="expenses"
          transform={(data: any) => ({ ...data, account_id: selectedAccountId })}
          mutationOptions={{
            onSuccess: onSuccess
          }}
        >
          <SimpleForm>
            <TextInput source="description" label="Description" validate={[required()]} fullWidth />
            <NumberInput source="amount" label="Montant" validate={[required()]} fullWidth />
            <DateInput source="date" label="Date" validate={[required()]} defaultValue={new Date()} fullWidth />

            <ReferenceInput source="category_id" reference="categories" filter={{ account_id: selectedAccountId }}>
              <SelectInput optionText="name" label="Catégorie" fullWidth />
            </ReferenceInput>

            <TextInput source="notes" label="Notes" multiline fullWidth />
            <BooleanInput source="reconciled" label="Pointé" defaultValue={false} />
          </SimpleForm>
        </CreateBase>
      </Box>
    </Drawer>
  );
};
