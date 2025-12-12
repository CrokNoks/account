import {
  Create,
  SimpleForm,
  TextInput,
  NumberInput,
  SelectInput,
  required,
  useRedirect,
  useTranslate,
} from 'react-admin';
import { ColorInput } from '../../components/ColorInput';
import { useAccount } from '../../context/AccountContext';
import { AccountRequired } from '../../components/AccountRequired';

export const CategoryCreate = () => {
  const { selectedAccountId } = useAccount();
  const redirect = useRedirect();

  const translate = useTranslate();
  const transform = (data: any) => ({
    ...data,
    account_id: selectedAccountId,
  });

  if (!selectedAccountId) {
    return <div><AccountRequired message="app.components.account_required.message" /></div>;
  }

  return (
    <Create
      transform={transform}
      mutationOptions={{
        onSuccess: () => {
          redirect('/categories');
        },
      }}
    >
      <SimpleForm>
        <TextInput source="name" label="resources.categories.fields.name" validate={[required()]} />
        <TextInput source="description" label="resources.categories.fields.description" />
        <ColorInput source="color" label="resources.categories.fields.color" fullWidth />
        <SelectInput
          source="type"
          label="resources.categories.fields.type"
          choices={[
            { id: 'expense', name: translate('resources.categories.fields.type_choices.expense') },
            { id: 'income', name: translate('resources.categories.fields.type_choices.income') },
          ]}
          helperText="resources.categories.fields.type_helper"
        />
        <NumberInput
          source="budget"
          label="resources.categories.fields.budget_label"
          helperText="resources.categories.fields.budget_helper"
          min={0}
        />
      </SimpleForm>
    </Create>
  );
};
