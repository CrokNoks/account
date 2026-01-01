import { Create, SimpleForm, NumberInput, BooleanInput, ReferenceInput, AutocompleteInput, required, Loading, useGetList } from 'react-admin';
import { useAccount } from '../../context/AccountContext';

export const BudgetTemplateCreate = () => {
  const { selectedAccountId } = useAccount();

  // Fetch existing templates to filter out already used categories
  const { data: existingTemplates, isLoading: isTemplatesLoading } = useGetList(
    'budget-templates',
    {
      filter: { account_id: selectedAccountId },
      pagination: { page: 1, perPage: 1000 } // Fetch all (reasonable limit)
    },
    { enabled: !!selectedAccountId }
  );

  if (!selectedAccountId || isTemplatesLoading) return <Loading />;

  const usedCategoryIds = existingTemplates?.map(t => t.category_id) || [];
  console.log('usedCategoryIds:', usedCategoryIds);

  return (
    <Create transform={data => ({ ...data, account_id: selectedAccountId })} redirect="create">
      <SimpleForm>
        <ReferenceInput
          source="category_id"
          reference="categories"
          filter={{
            account_id: selectedAccountId,
            id_nin: usedCategoryIds
          }}
        >
          <AutocompleteInput optionText="name" validate={required()} label="Catégorie" />
        </ReferenceInput>
        <NumberInput source="amount_base" label="Montant Base" validate={required()} />
        <BooleanInput source="is_fixed" label="Dépense Fixe ?" />
        <NumberInput source="account_id" defaultValue={selectedAccountId} style={{ display: 'none' }} />
      </SimpleForm>
    </Create>
  );
};
