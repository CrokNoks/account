import {
  List,
  Datagrid,
  TextField,
  EditButton,
  DeleteButton,
} from 'react-admin';
import { NumberField, SimpleList } from 'ra-ui-materialui';
import { ColorField } from '../../components/ColorField';
import { useAccount } from '../../context/AccountContext';
import { ImportCategoriesButton } from './ImportCategoriesButton';
import { useIsSmall } from '../../hooks/isSmall';
import { ImportCreateToolbar } from '../../components/ImportCreateToolbar';
import { AccountRequired } from '../../components/AccountRequired';

const CategoryListActions = () => (
  <ImportCreateToolbar importButton={<ImportCategoriesButton />} />
);

export const CategoryList = () => {
  const { selectedAccountId } = useAccount();
  const isSmall = useIsSmall();

  if (!selectedAccountId) {
    return <AccountRequired message="Veuillez sélectionner un compte pour voir les catégories." />;
  }

  return (
    <List
      filter={{ account_id: selectedAccountId }}
      actions={<CategoryListActions />}
    >
      {isSmall ? (
        <SimpleList
          primaryText={(record) => record.name}
          secondaryText={(record) => record.description}
          tertiaryText={(record) =>
            new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(
              record.budget || 0
            )
          }
        />
      ) : (
        <Datagrid rowClick="edit">
          <TextField source="name" label="Nom" />
          <TextField source="description" label="Description" />
          <TextField source="type" label="Type" />
          <ColorField source="color" label="Couleur" />
          <NumberField
            source="budget"
            label="Budget"
            options={{ style: 'currency', currency: 'EUR' }}
          />
          <EditButton />
          <DeleteButton />
        </Datagrid>
      )}
    </List>
  );
};

