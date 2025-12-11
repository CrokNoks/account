import {
  Create,
  SimpleForm,
  TextInput,
  NumberInput,
  DateInput,
  ReferenceInput,
  SelectInput,
  required,
  FormDataConsumer,
  useRedirect,
} from 'react-admin';
import { useAccount } from '../../context/AccountContext';

export const TransferCreate = () => {
  const { selectedAccountId } = useAccount();
  const redirect = useRedirect();

  const defaultValues: any = {
    date: new Date().toISOString().slice(0, 10),
  };

  if (selectedAccountId) {
    defaultValues.source_account_id = selectedAccountId;
  }

  return (
    <Create
      resource="transfers"
      mutationOptions={{
        onSuccess: () => {
          redirect('/reports');
        },
      }}
    >
      <SimpleForm defaultValues={defaultValues}>
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
        />

        <DateInput
          source="date"
          label="resources.expenses.fields.date"
          validate={[required()]}
        />

        {/* Compte et catégorie source */}
        <ReferenceInput
          source="source_account_id"
          reference="accounts"
          label="resources.transfers.fields.source_account_id"
        >
          <SelectInput optionText="name" validate={[required()]} />
        </ReferenceInput>

        <FormDataConsumer>
          {({ formData, ...rest }) => (
            <ReferenceInput
              source="source_category_id"
              reference="categories"
              label="resources.transfers.fields.source_category_id"
              filter={{ account_id: formData.source_account_id }}
              {...rest}
            >
              <SelectInput optionText="name" validate={[required()]} />
            </ReferenceInput>
          )}
        </FormDataConsumer>

        {/* Compte et catégorie destination */}
        <ReferenceInput
          source="destination_account_id"
          reference="accounts"
          label="resources.transfers.fields.destination_account_id"
        >
          <SelectInput optionText="name" validate={[required()]} />
        </ReferenceInput>

        <FormDataConsumer>
          {({ formData, ...rest }) => (
            <ReferenceInput
              source="destination_category_id"
              reference="categories"
              label="resources.transfers.fields.destination_category_id"
              filter={{ account_id: formData.destination_account_id }}
              {...rest}
            >
              <SelectInput optionText="name" validate={[required()]} />
            </ReferenceInput>
          )}
        </FormDataConsumer>

        <TextInput source="notes" label="resources.expenses.fields.note" multiline fullWidth />
      </SimpleForm>
    </Create>
  );
};


