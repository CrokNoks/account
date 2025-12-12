import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Box,
  Chip,
  Tooltip
} from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useTranslate, useLocale } from 'react-admin';
import { CategoryShip } from './CategoryShip';

interface CategoryData {
  name: string;
  value: number;
  color: string;
  budget?: number;
}

interface CategorySummaryTableProps {
  data: CategoryData[];
  title: string;
  type?: 'expense' | 'income';
}

export const CategorySummaryTable = ({ data, title, type = 'expense' }: CategorySummaryTableProps) => {
  const translate = useTranslate();
  const locale = useLocale();
  const total = data.reduce((sum, cat) => sum + cat.value, 0);
  const totalBudget = data.reduce((sum, cat) => sum + (cat.budget || 0), 0);

  return (
    <Box>
      {title && (
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>
      )}
      <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell>{translate('app.category_summary.category')}</TableCell>
              <TableCell align="right">{translate('app.category_summary.amount')}</TableCell>
              <TableCell align="right" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>{translate('app.category_summary.budget')}</TableCell>
              <TableCell align="right" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>{translate('app.category_summary.total_percent')}</TableCell>
              <TableCell align="center" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>{translate('app.category_summary.status')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((category, index) => {
              const percentage = total > 0 ? (category.value / total) * 100 : 0;
              const hasBudget = category.budget && category.budget > 0;
              const budgetUsagePercent = hasBudget ? (category.value / category.budget!) * 100 : 0;

              // Logic for highlighting rows and status
              let isOverBudget = false;
              let statusColor: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' = 'default';
              let StatusIcon = CheckCircleIcon;
              let tooltipText = '';

              if (hasBudget) {
                if (type === 'expense') {
                  // Expense logic: Over budget is bad (Red)
                  isOverBudget = category.value > category.budget!;
                  if (isOverBudget) {
                    statusColor = 'error';
                    StatusIcon = WarningIcon;
                    tooltipText = translate('app.category_summary.budget_exceeded', { percent: budgetUsagePercent.toFixed(0) });
                  } else if (budgetUsagePercent > 80) {
                    statusColor = 'warning';
                    tooltipText = translate('app.category_summary.budget_used', { percent: budgetUsagePercent.toFixed(0) });
                  } else {
                    statusColor = 'success';
                    tooltipText = translate('app.category_summary.budget_used', { percent: budgetUsagePercent.toFixed(0) });
                  }
                } else {
                  // Income logic: Over budget (goal) is good (Green)
                  const isGoalMet = category.value >= category.budget!;
                  if (isGoalMet) {
                    statusColor = 'success';
                    StatusIcon = CheckCircleIcon;
                    tooltipText = translate('app.category_summary.goal_met', { percent: budgetUsagePercent.toFixed(0) });
                  } else {
                    // Under goal
                    statusColor = 'warning';
                    StatusIcon = WarningIcon;
                    tooltipText = translate('app.category_summary.goal_not_met', { percent: budgetUsagePercent.toFixed(0) });
                  }
                }
              }

              return (
                <TableRow
                  key={index}
                  hover
                  sx={{
                    backgroundColor: (type === 'expense' && isOverBudget) ? 'error.light' : 'inherit',
                    '&:hover': {
                      backgroundColor: (type === 'expense' && isOverBudget) ? 'error.main' : 'action.hover',
                    }
                  }}
                >
                  <TableCell>
                    <CategoryShip cat={category} />
                  </TableCell>
                  <TableCell align="right">
                    <Typography
                      variant="body2"
                      fontWeight="medium"
                      color={(type === 'expense' && isOverBudget) ? 'error.dark' : 'inherit'}
                    >
                      {new Intl.NumberFormat(locale, {
                        style: 'currency',
                        currency: 'EUR',
                      }).format(category.value)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                    {hasBudget ? (
                      <Typography variant="body2" color="text.secondary">
                        {new Intl.NumberFormat(locale, {
                          style: 'currency',
                          currency: 'EUR',
                        }).format(category.budget!)}
                      </Typography>
                    ) : (
                      <Typography variant="body2" color="text.disabled">
                        -
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                    <Typography variant="body2" color="text.secondary">
                      {percentage.toFixed(1)}%
                    </Typography>
                  </TableCell>
                  <TableCell align="center" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                    {hasBudget ? (
                      <Tooltip title={tooltipText}>
                        <Chip
                          icon={<StatusIcon />}
                          label={`${budgetUsagePercent.toFixed(0)}%`}
                          color={statusColor}
                          size="small"
                        />
                      </Tooltip>
                    ) : (
                      <Typography variant="body2" color="text.disabled">
                        -
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            <TableRow sx={{ backgroundColor: 'action.hover' }}>
              <TableCell>
                <Typography variant="body1" fontWeight="bold">
                  {translate('app.category_summary.total')}
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Typography variant="body1" fontWeight="bold">
                  {new Intl.NumberFormat(locale, {
                    style: 'currency',
                    currency: 'EUR',
                  }).format(total)}
                </Typography>
              </TableCell>
              <TableCell align="right" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                <Typography variant="body1" fontWeight="bold">
                  {new Intl.NumberFormat(locale, {
                    style: 'currency',
                    currency: 'EUR',
                  }).format(totalBudget)}
                </Typography>
              </TableCell>
              <TableCell align="right" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                <Typography variant="body1" fontWeight="bold">
                  100%
                </Typography>
              </TableCell>
              <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }} />
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};
