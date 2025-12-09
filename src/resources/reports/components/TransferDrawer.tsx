import { Drawer, Box, Typography, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { CreateBase, SimpleForm, TextInput, NumberInput, DateInput, ReferenceInput, SelectInput, required, useDataProvider, useNotify } from 'react-admin';
import { useAccount } from '../../../context/AccountContext';
import { useFormContext } from 'react-hook-form';

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
        label="Description"
        validate={[required()]}
        fullWidth
      />
      <NumberInput
        source="amount"
        label="Montant"
        validate={[required()]}
        fullWidth
      />
      <DateInput
        source="date"
        label="Date"
        validate={[required()]}
        defaultValue={new Date()}
        fullWidth
      />

      <ReferenceInput
        source="source_account_id"
        reference="accounts"
        label="Compte source"
        defaultValue={selectedAccountId}
      >
        <SelectInput optionText="name" validate={[required()]} fullWidth />
      </ReferenceInput>

      <ReferenceInput
        source="source_category_id"
        reference="categories"
        label="Catégorie (dépense)"
        filter={{ account_id: sourceAccountId }}
        perPage={100}
        sort={{ field: 'name', order: 'ASC' }}
        key={`source-cat-${sourceAccountId}`}
      >
        <SelectInput optionText="name" fullWidth />
      </ReferenceInput>

      <ReferenceInput
        source="destination_account_id"
        reference="accounts"
        label="Compte destination"
      >
        <SelectInput optionText="name" validate={[required()]} fullWidth />
      </ReferenceInput>

      <ReferenceInput
        source="destination_category_id"
        reference="categories"
        label="Catégorie (revenu)"
        filter={{ account_id: targetAccountId }}
        perPage={100}
        sort={{ field: 'name', order: 'ASC' }}
        key={`target-cat-${targetAccountId}`}
      >
        <SelectInput optionText="name" fullWidth />
      </ReferenceInput>

      <TextInput
        source="notes"
        label="Notes"
        multiline
        fullWidth
      />
    </>
  );
};

export const TransferDrawer = ({ open, onClose, onSuccess }: TransferDrawerProps) => {
  const dataProvider = useDataProvider();
  const notify = useNotify();

  const handleSubmit = async (data: any) => {
    try {
      // Créer la dépense sur le compte source
      await dataProvider.create('expenses', {
        data: {
          description: data.description,
          amount: -Math.abs(data.amount), // Montant négatif pour la dépense
          date: data.date,
          account_id: data.source_account_id,
          category_id: data.source_category_id || null,
          notes: data.notes || '',
          reconciled: false,
        },
      });

      // Créer le revenu sur le compte cible
      await dataProvider.create('expenses', {
        data: {
          description: data.description,
          amount: Math.abs(data.amount), // Montant positif pour le revenu
          date: data.date,
          account_id: data.destination_account_id,
          category_id: data.destination_category_id || null,
          notes: data.notes || '',
          reconciled: false,
        },
      });

      notify('Virement créé avec succès', { type: 'success' });
      onSuccess();
    } catch (error) {
      console.error('Error creating transfer:', error);
      notify('Erreur lors de la création du virement', { type: 'error' });
    }
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
    >
      <Box sx={{ width: { xs: '100vw', sm: 400 }, p: 2 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">
            Nouveau virement
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
