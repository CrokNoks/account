import { 
    Edit, 
    SimpleForm, 
    TextInput, 
    required
} from 'react-admin';
import { AccountSharesManager } from './AccountSharesManager';

export const AccountEdit = () => {


    return (
        <Edit>
            <SimpleForm>
                <TextInput source="name" label="Nom du compte" validate={[required()]} fullWidth />
                
                <TextInput 
                    source="initial_balance" 
                    label="Solde initial du compte (€)" 
                    helperText="Solde de départ pour le premier rapport"
                    type="number"
                    fullWidth 
                />
                <AccountSharesManager />
            </SimpleForm>
        </Edit>
    );
};
