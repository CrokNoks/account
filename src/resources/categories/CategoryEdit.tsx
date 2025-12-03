import {
  Edit,
  SimpleForm,
  TextInput,
  NumberInput,
  SelectInput,
  required,
} from 'react-admin';
import { ColorInput } from '../../components/ColorInput';


export const CategoryEdit = () => (
  <Edit>
    <SimpleForm>
      <TextInput source="name" label="Nom" validate={[required()]} />
      <TextInput source="description" label="Description" />
      <ColorInput source="color" label="Couleur" />
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
  </Edit>
);
