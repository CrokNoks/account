import {
  List,
  Datagrid,
  TextField,
  EditButton,
  DeleteButton,
} from 'react-admin';
import { TopToolbar, CreateButton, NumberField } from 'ra-ui-materialui';
import { ColorField } from '../../components/ColorField';
import { useAccount } from '../../context/AccountContext';
import { ImportCategoriesButton } from './ImportCategoriesButton';

const CategoryListActions = () => (
  <TopToolbar>
    <ImportCategoriesButton />
    <CreateButton />
  </TopToolbar>
);

export const CategoryList = () => {
  const { selectedAccountId } = useAccount();

  if (!selectedAccountId) {
    return (
      <List>
        <div>Veuillez sélectionner un compte pour voir les catégories.</div>
      </List>
    );
  }

  return (
    <List
      filter={{ account_id: selectedAccountId }}
      actions={<CategoryListActions />}
    >
      <Datagrid rowClick="edit">
        <TextField source="name" label="Nom" />
        <TextField source="description" label="Description" />
        <TextField source="type" label="Type" />
        <ColorField source="color" label="Couleur" />
        <NumberField source="budget" label="Budget"
          options={{ style: 'currency', currency: 'EUR' }} />
        <EditButton />
        <DeleteButton />
      </Datagrid>
    </List>
  );
};
