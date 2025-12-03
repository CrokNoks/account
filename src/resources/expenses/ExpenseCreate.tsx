import {
  Create,
  SimpleForm,
  TextInput,
  NumberInput,
  DateInput,
  ReferenceInput,
  SelectInput,
  required,
  BooleanInput,
  useRedirect,
} from 'react-admin';
import { useAccount } from '../../context/AccountContext';

export const ExpenseCreate = () => {
  const { selectedAccountId } = useAccount();
  const redirect = useRedirect();

  const transform = (data: any) => ({
    ...data,
    account_id: selectedAccountId,
  });

  if (!selectedAccountId) {
      return <div>Veuillez sélectionner un compte avant de créer une dépense.</div>;
  }

  return (
    <Create
      transform={transform}
      mutationOptions={{
        onSuccess: () => {
          redirect('/reports');
        },
      }}
    >
      <SimpleForm>
        <TextInput source="description" label="Description" validate={[required()]} fullWidth />
        <NumberInput source="amount" label="Montant" validate={[required()]} />
        <DateInput source="date" label="Date" validate={[required()]} defaultValue={new Date()} />
        
        <ReferenceInput source="category_id" reference="categories" filter={{ account_id: selectedAccountId }}>
          <SelectInput optionText="name" label="Catégorie" />
        </ReferenceInput>
        
        <TextInput source="notes" label="Notes" multiline fullWidth />
        <BooleanInput source="reconciled" label="Pointé" defaultValue={false} />
      </SimpleForm>
    </Create>
  );
};
