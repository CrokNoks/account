import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Box,
  Chip
} from '@mui/material';
import { useTranslate } from 'react-admin';

interface CategoryBudgetTableProps {
  globalType: 'income' | 'expense';
  data: {
    category: any;
    budgeted: number;
    spent: number;
    remaining: number;
  }[];
}

export const CategoryBudgetTable = ({ data, globalType }: CategoryBudgetTableProps) => {
  const translate = useTranslate();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  return (
    <TableContainer component={Paper}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>{translate('resources.categories.fields.name')}</TableCell>
            <TableCell align="right">{translate('app.budget.fields.budgeted')}</TableCell>
            <TableCell align="right">{translate(`app.budget.fields.${globalType}`)}</TableCell>
            <TableCell align="right">{translate('app.budget.fields.remaining_percent')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.map((row) => {
            const spentAbs = Math.abs(row.spent);

            let label = '-';
            let expenseColor: 'default' | 'success' | 'error' = 'default';
            let incomeColor: 'default' | 'success' | 'error' = 'default';
            let variant: 'outlined' | 'filled' = 'outlined';

            if (row.budgeted > 0) {
              const percentage = Math.ceil((spentAbs / row.budgeted) * 100);
              label = `${percentage}%`;
              expenseColor = percentage > 100 ? 'error' : 'success';
              incomeColor = percentage >= 100 ? 'success' : 'error';
              variant = percentage > 100 ? 'filled' : 'outlined';
            }

            return (
              <TableRow key={row.category.id}>
                <TableCell component="th" scope="row">
                  <Box display="flex" alignItems="center" gap={1}>
                    <Box
                      sx={{
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        bgcolor: row.category.color,
                        border: '1px solid rgba(0,0,0,0.1)'
                      }}
                    />
                    {row.category.name}
                  </Box>
                </TableCell>
                <TableCell align="right">{formatCurrency(row.budgeted)}</TableCell>
                <TableCell align="right">{formatCurrency(spentAbs)}</TableCell>
                <TableCell align="right" sx={{ width: '15%' }}>
                  <Chip
                    label={label}
                    color={globalType === 'income' ? incomeColor : expenseColor}
                    size="small"
                    variant={variant}
                    sx={{ fontWeight: 'bold' }}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
};
