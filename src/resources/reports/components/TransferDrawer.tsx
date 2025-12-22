import { Drawer, Box, Typography, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { CreateBase, SimpleForm, TextInput, NumberInput, DateInput, ReferenceInput, SelectInput, AutocompleteInput, required, useTranslate } from 'react-admin';
import { useAccount } from '../../../context/AccountContext';
import { useFormContext } from 'react-hook-form';
import { useTransferActions } from '../hooks/useTransferActions';

interface TransferDrawerProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const FormFields = () => {
  const { selectedAccountId } = useAccount();
  const { watch } = useFormContext();
  const sourceAccountId = watch('source_account_id') || selectedAccountId;
  const targetAccountId = watch('destination_account_id') || selectedAccountId;

  return (
    <>
      <TextInput
        source="description"
        label="resources.expenses.fields.description"
        validate={[required()]}
        fullWidth
      />
      <NumberInput
        source="amount"
        label="resources.expenses.fields.amount"
        validate={[required()]}
        fullWidth
      />
      <DateInput
        source="date"
        label="resources.expenses.fields.date"
        validate={[required()]}
        defaultValue={new Date()}
        fullWidth
      />

      <ReferenceInput
        source="source_account_id"
        reference="accounts"
        label="app.drawers.transfer_source"
        defaultValue={selectedAccountId}
      >
        <SelectInput optionText="name" validate={[required()]} fullWidth />
      </ReferenceInput>

      <ReferenceInput
        source="source_category_id"
        reference="categories"
        label="resources.expenses.fields.category_id"
        filter={{ account_id: sourceAccountId }}
        perPage={100}
        sort={{ field: 'name', order: 'ASC' }}
        key={`source-cat-${sourceAccountId}`}
      >
        <AutocompleteInput
          optionText="name"
          filterToQuery={searchText => ({ name: searchText })}
          fullWidth
        />
      </ReferenceInput>

      <ReferenceInput
        source="destination_account_id"
        reference="accounts"
        label="app.drawers.transfer_target"
      >
        <SelectInput optionText="name" validate={[required()]} fullWidth />
      </ReferenceInput>

      <ReferenceInput
        source="destination_category_id"
        reference="categories"
        label="resources.expenses.fields.category_id"
        filter={{ account_id: targetAccountId }}
        perPage={100}
        sort={{ field: 'name', order: 'ASC' }}
        key={`target-cat-${targetAccountId}`}
      >
        <AutocompleteInput
          optionText="name"
          filterToQuery={searchText => ({ name: searchText })}
          fullWidth
        />
      </ReferenceInput>

      <TextInput
        source="notes"
        label="resources.expenses.fields.note"
        multiline
        fullWidth
      />
    </>
  );
};

export const TransferDrawer = ({ open, onClose, onSuccess }: TransferDrawerProps) => {
  const translate = useTranslate();
  const { createTransfer } = useTransferActions();

  const handleSubmit = (data: any) => {
    createTransfer(data, onSuccess);
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
            {translate('app.drawers.new_transfer')}
          </Typography>
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>

        <CreateBase
          resource="transfers"
          transform={(data: any) => data}
          redirect={false}
          mutationOptions={{
            onSuccess: (data) => {
              handleSubmit(data);
            }
          }}
        >
          <SimpleForm>
            <FormFields />
          </SimpleForm>
        </CreateBase>
      </Box>
    </Drawer>
  );
};
