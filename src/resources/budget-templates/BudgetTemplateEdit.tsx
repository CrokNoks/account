import { Edit, SimpleForm, NumberInput, BooleanInput, ReferenceInput, SelectInput, useGetIdentity } from 'react-admin';

export const BudgetTemplateEdit = () => {
  const { identity } = useGetIdentity();

  return (
    <Edit>
      <SimpleForm>
        <ReferenceInput source="category_id" reference="categories" filter={identity ? { account_id: identity.id } : {}}>
          <SelectInput optionText="name" disabled />
        </ReferenceInput>
        <NumberInput source="amount_base" label="Montant Base" />
        <BooleanInput source="is_fixed" label="Dépense Fixe ?" />
      </SimpleForm>
    </Edit>
  );
};
