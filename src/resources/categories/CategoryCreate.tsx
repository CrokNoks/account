import {
  Create,
  SimpleForm,
  TextInput,
  NumberInput,
  SelectInput,
  required,
} from 'react-admin';
import { ColorInput } from '../../components/ColorInput';
import { useAccount } from '../../context/AccountContext';

export const CategoryCreate = () => {
  const { selectedAccountId } = useAccount();

  const transform = (data: any) => ({
    ...data,
    account_id: selectedAccountId,
  });

  if (!selectedAccountId) {
    return <div>Veuillez sélectionner un compte avant de créer une catégorie.</div>;
  }

  return (
    <Create transform={transform}>
      <SimpleForm>
        <TextInput source="name" label="Nom" validate={[required()]} />
        <TextInput source="description" label="Description" />
        <ColorInput source="color" label="Couleur" fullWidth />
        <SelectInput
          source="type"
          label="Type"
          choices={[
            { id: 'expense', name: 'Dépense' },
            { id: 'income', name: 'Revenu' },
          ]}
          helperText="Définit si le budget est une limite (Dépense) ou un objectif (Revenu)"
        />
        <NumberInput
          source="budget"
          label="Budget mensuel (optionnel)"
          helperText="Définir un budget pour recevoir des alertes en cas de dépassement"
          min={0}
        />
      </SimpleForm>
    </Create>
  );
};
