import {
  Edit,
  SimpleForm,
  TextInput,
  NumberInput,
  SelectInput,
  required,
  useTranslate,
} from 'react-admin';
import { ColorInput } from '../../components/ColorInput';


export const CategoryEdit = () => {
  const translate = useTranslate();
  return (
    <Edit>
      <SimpleForm>
        <TextInput source="name" label="resources.categories.fields.name" validate={[required()]} />
        <TextInput source="description" label="resources.categories.fields.description" />
        <ColorInput source="color" label="resources.categories.fields.color" />
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
    </Edit>
  );
};
