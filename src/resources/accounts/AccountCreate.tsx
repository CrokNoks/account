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
                <TextInput source="name" label="Nom du compte" validate={[required()]} />
            </SimpleForm>
        </Create>
    );
};
