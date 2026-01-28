import {
  Datagrid,
  FunctionField,
  useList,
  ListContextProvider,
  useLocale,
} from 'react-admin';
import { Box, Chip } from '@mui/material';
import React from 'react';

interface CategoryBudgetTableProps {
  globalType: 'income' | 'expense' | 'transfer' | 'savings';
  data: {
    category: any;
    budgeted: number;
    spent: number;
    remaining: number;
  }[];
}

export const CategoryBudgetTable = ({ data, globalType }: CategoryBudgetTableProps) => {
  const locale = useLocale();

  const listData = React.useMemo(() => {
    return data.map(row => {
      const spentAbs = Math.abs(row.spent);
      let percentage = 0;
      if (row.budgeted > 0) {
        percentage = Math.ceil((spentAbs / row.budgeted) * 100);
      }
      if (globalType === 'expense' || globalType === 'transfer') {
        percentage = Math.round(((row.budgeted - spentAbs) / row.budgeted) * 100);
      }
      return {
        id: row.category.id, // Datagrid needs an id
        ...row,
        spentAbs,
        percentage,
        categoryName: row.category.name, // Flatten for easier sorting if needed
        categoryColor: row.category.color
      };
    });
  }, [data]);

  const listContext = useList({
    data: listData,
    perPage: 100, // Show all
    sort: { field: 'budgeted', order: 'DESC' }, // Default sort
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  return (
    <ListContextProvider value={listContext}>
      <Datagrid
        bulkActionButtons={false}
        sx={{
          '& .RaDatagrid-headerCell': { fontWeight: 'bold' },
        }}
      >
        <FunctionField
          label="resources.categories.fields.name"
          sortBy="categoryName"
          render={(record: any) => (
            <Box display="flex" alignItems="center" gap={1}>
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  bgcolor: record.categoryColor,
                  border: '1px solid rgba(0,0,0,0.1)'
                }}
              />
              {record.categoryName}
            </Box>
          )}
        />

        <FunctionField
          label="app.budget.fields.budgeted"
          source="budgeted"
          textAlign="right"
          render={(record: any) => formatCurrency(record.budgeted)}
        />

        <FunctionField
          label={`app.budget.fields.${globalType}`}
          source="spentAbs"
          textAlign="right"
          render={(record: any) => formatCurrency(record.spentAbs)}
        />

        <FunctionField
          label="app.budget.fields.remaining_percent"
          source="percentage"
          textAlign="right"
          render={(record: any) => {
            let label = '-';
            let color: 'default' | 'success' | 'error' = 'default';
            let variant: 'outlined' | 'filled' = 'outlined';

            if (record.budgeted > 0) {
              label = `${record.percentage}%`;
              if (globalType === 'expense' || globalType === 'transfer') {
                if (record.percentage > 0.5) {
                  // Reste positif (> +0.5%)
                  color = 'success';
                  variant = 'outlined';
                } else if (record.percentage >= -0.5 && record.percentage <= 0.5) {
                  // Reste ≈ 0 (-0.5% à +0.5%)
                  color = 'default';
                  variant = 'outlined';
                } else {
                  // Reste négatif (< -0.5%)
                  color = 'error';
                  variant = 'filled';
                }
              } else {
                // Income & Savings: >100% is good
                color = record.percentage >= 100 ? 'success' : 'error';
                variant = record.percentage > 100 ? 'filled' : 'outlined';
              }
            }

            return (
              <Chip
                label={label}
                color={color}
                size="small"
                variant={variant}
                sx={{ fontWeight: 'bold' }}
              />
            );
          }}
        />
      </Datagrid>
    </ListContextProvider>
  );
};
