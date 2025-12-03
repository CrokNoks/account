import {
  Edit,
  SimpleForm,
  TextInput,
  NumberInput,
  DateInput,
  ReferenceInput,
  SelectInput,
  required,
  BooleanInput,
} from 'react-admin';
import { useAccount } from '../../context/AccountContext';

export const ExpenseEdit = () => {
    const { selectedAccountId } = useAccount();

    return (
      <Edit>
        <SimpleForm>
          <TextInput source="description" label="Description" validate={[required()]} fullWidth />
          <NumberInput source="amount" label="Montant" validate={[required()]} />
          <DateInput source="date" label="Date" validate={[required()]} />
          
          <ReferenceInput source="category_id" reference="categories" filter={{ account_id: selectedAccountId }}>
            <SelectInput optionText="name" label="Catégorie" />
          </ReferenceInput>
          
          <TextInput source="notes" label="Notes" multiline fullWidth />
          <BooleanInput source="reconciled" label="Pointé" />
        </SimpleForm>
      </Edit>
    );
};
