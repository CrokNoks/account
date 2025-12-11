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
    return <AccountRequired message="app.components.account_required.message" />;
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
          <TextField source="name" label="resources.categories.fields.name" />
          <TextField source="description" label="resources.categories.fields.description" />
          <TextField source="type" label="resources.categories.fields.type" />
          <ColorField source="color" label="resources.categories.fields.color" />
          <NumberField
            source="budget"
            label="resources.categories.fields.budget"
            options={{ style: 'currency', currency: 'EUR' }}
          />
          <EditButton />
          <DeleteButton />
        </Datagrid>
      )}
    </List>
  );
};

