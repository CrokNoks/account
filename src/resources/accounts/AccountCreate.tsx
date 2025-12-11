import { Create, SimpleForm, TextInput, required } from 'react-admin';
import { supabaseClient } from '../../supabaseClient';

export const AccountCreate = () => {

  const transform = async (data: any) => {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    return {
      ...data,
      owner_id: user.id
    };
  };

  return (
    <Create transform={transform}>
      <SimpleForm>
        <TextInput source="name" label="resources.accounts.fields.name" validate={[required()]} fullWidth />
        <TextInput
          source="initial_balance"
          label="resources.accounts.fields.initial_balance"
          helperText="resources.accounts.fields.initial_balance_helper"
          type="number"
          fullWidth
        />
      </SimpleForm>
    </Create>
  );
};
