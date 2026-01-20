import React, { useMemo, useCallback } from 'react';
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
import { useCategories } from '../../hooks/useSupabaseQuery';
import { formatCurrency } from '../../utils/formatters';
import { AutoColorCategoriesButton } from './AutoColorCategoriesButton';

// Memoize the actions component to prevent unnecessary re-renders
const CategoryListActions = React.memo(() => (
  <ImportCreateToolbar
    importButton={<ImportCategoriesButton />}
  >
    <AutoColorCategoriesButton />
  </ImportCreateToolbar>
));

CategoryListActions.displayName = 'CategoryListActions';

// Memoize the SimpleList item component for better performance
const SimpleListItem = React.memo((record: any) => (
  <>
    {record.name}
    {record.description && ` - ${record.description}`}
  </>
));

SimpleListItem.displayName = 'SimpleListItem';

const SimpleListSecondary = React.memo((record: any) => (
  formatCurrency(record.budget || 0)
));

SimpleListSecondary.displayName = 'SimpleListSecondary';

export const CategoryListOptimized = React.memo(() => {
  const { selectedAccountId } = useAccount();
  const isSmall = useIsSmall();

  // Use optimized query
  const { isLoading } = useCategories(selectedAccountId);

  // Memoize filter to prevent recreation
  const filter = useMemo(() => ({
    account_id: selectedAccountId,
  }), [selectedAccountId]);

  // Memoize actions component
  const actions = useMemo(() => <CategoryListActions />, []);

  // Memoize primary text function for SimpleList
  const primaryText = useCallback((record: any) => (
    <SimpleListItem {...record} />
  ), []);

  // Memoize secondary text function for SimpleList
  const secondaryText = useCallback((record: any) => (
    <SimpleListSecondary {...record} />
  ), []);

  if (!selectedAccountId) {
    return <AccountRequired message="app.components.account_required.message" />;
  }

  return (
    <List
      filter={filter}
      actions={actions}
      loading={isLoading}
      queryOptions={{
        staleTime: 1000 * 60 * 5, // 5 minutes
        refetchOnWindowFocus: false,
      }}
      empty={
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <p>No categories found. Create your first category to get started.</p>
        </div>
      }
    >
      {isSmall ? (
        <SimpleList
          primaryText={primaryText}
          secondaryText={secondaryText}
          leftIcon={(record) => (
            <div
              style={{
                width: 20,
                height: 20,
                borderRadius: '50%',
                backgroundColor: record.color || '#ccc',
              }}
            />
          )}
        />
      ) : (
        <Datagrid 
          rowClick="edit"
          sx={{
            '& .MuiDataGrid-row': {
              '&:nth-of-type(odd)': {
                backgroundColor: 'action.hover',
              },
            },
          }}
        >
          <TextField 
            source="name" 
            label="resources.categories.fields.name" 
            sortable={true}
          />
          <TextField 
            source="description" 
            label="resources.categories.fields.description"
            sortable={false}
          />
          <TextField 
            source="type" 
            label="resources.categories.fields.type"
            sortable={true}
          />
          <ColorField 
            source="color" 
            label="resources.categories.fields.color"
          />
          <NumberField
            source="budget"
            label="resources.categories.fields.budget"
            options={{ style: 'currency', currency: 'EUR' }}
            sortable={true}
          />
          <EditButton />
          <DeleteButton />
        </Datagrid>
      )}
    </List>
  );
});

CategoryListOptimized.displayName = 'CategoryListOptimized';

// Export optimized version as default
export const CategoryList = CategoryListOptimized;