import { Drawer, Box, Typography, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { CreateBase, SimpleForm, TextInput, NumberInput, DateInput, ReferenceInput, AutocompleteInput, BooleanInput, required } from 'react-admin';
import { useState } from 'react';

interface AddExpenseDrawerProps {
  open: boolean;
  onClose: () => void;
  selectedAccountId: string;
  onSuccess: () => void;
}

export const AddExpenseDrawer = ({ open, onClose, selectedAccountId, onSuccess }: AddExpenseDrawerProps) => {
  const [formKey, setFormKey] = useState(0);

  const handleSuccess = () => {
    onSuccess(); // Refresh the report
    setFormKey(prev => prev + 1); // Reset the form by changing the key
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
    >
      <Box sx={{ width: { xs: '100%', sm: 400 }, p: 2 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">
            Ajouter une opération
          </Typography>
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>

        <CreateBase
          key={formKey}
          resource="expenses"
          transform={(data: any) => ({ ...data, account_id: selectedAccountId })}
          redirect={false}
          mutationOptions={{ onSuccess: handleSuccess }}
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
      </Box>
    </Drawer>
  );
};
