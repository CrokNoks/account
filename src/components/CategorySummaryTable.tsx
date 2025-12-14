import { useState, useMemo } from 'react';
import { Datagrid, ListContextProvider, NumberField, FunctionField, useTranslate, useLocale, SortPayload, SimpleList } from 'react-admin';
import { Box, Typography, Chip, Tooltip, useMediaQuery, Theme, Accordion, AccordionSummary, AccordionDetails, Card, CardContent } from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { CategoryShip } from './CategoryShip';

const CategoryStatusChip = ({ record, type }: { record: CategoryData, type: 'expense' | 'income' }) => {
  const translate = useTranslate();

  const hasBudget = record.budget && record.budget > 0;
  if (!hasBudget) return <span>-</span>;

  const budgetUsagePercent = (record.value / record.budget!) * 100;
  let isOverBudget = false;
  let statusColor: any = 'default';
  let StatusIcon = CheckCircleIcon;
  let tooltipText = '';

  if (type === 'expense') {
    isOverBudget = record.value > record.budget!;
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
    // Income logic
    const isGoalMet = record.value >= record.budget!;
    if (isGoalMet) {
      statusColor = 'success';
      StatusIcon = CheckCircleIcon;
      tooltipText = translate('app.category_summary.goal_met', { percent: budgetUsagePercent.toFixed(0) });
    } else {
      statusColor = 'warning';
      StatusIcon = WarningIcon;
      tooltipText = translate('app.category_summary.goal_not_met', { percent: budgetUsagePercent.toFixed(0) });
    }
  }

  return (
    <Tooltip title={tooltipText}>
      <Chip
        icon={<StatusIcon />}
        label={`${budgetUsagePercent.toFixed(0)}%`}
        color={statusColor}
        size="small"
      />
    </Tooltip>
  );
};

export const CategorySummaryTable = ({ data, title, type = 'expense', sx = {} }: CategorySummaryTableProps) => {
  const translate = useTranslate();
  const locale = useLocale();
  const isSmall = useMediaQuery<Theme>(theme => theme.breakpoints.down('sm'));

  const total = data.reduce((sum, cat) => sum + cat.value, 0);
  const totalBudget = data.reduce((sum, cat) => sum + (cat.budget || 0), 0);

  // State for sorting
  const [sort, setSort] = useState<SortPayload>({ field: 'value', order: 'DESC' });

  // Memoized sorted data
  const sortedData = useMemo(() => {
    if (!sort.field) return data;

    return [...data].sort((a, b) => {
      const field = sort.field as keyof CategoryData;
      const order = sort.order === 'ASC' ? 1 : -1;

      const valA = a[field];
      const valB = b[field];

      // Handle properties
      if (field === 'name') {
        return order * (valA as string || '').localeCompare(valB as string || '');
      }

      // Handle numbers (value, budget)
      const numA = (valA as number) || 0;
      const numB = (valB as number) || 0;

      return order * (numA - numB);
    });
  }, [data, sort]);

  const listContext = {
    data: sortedData,
    total: sortedData.length,
    isLoading: false,
    page: 1,
    perPage: 100,
    setPage: () => { },
    setPerPage: () => { },
    setSort: (newSort: SortPayload) => setSort(newSort),
    sort,
    filterValues: {},
    setFilters: () => { },
    displayedFilters: {},
    hideFilter: () => { },
    showFilter: () => { },
    selectedIds: [],
    onSelect: () => { },
    onToggleItem: () => { },
    onUnselectItems: () => { },
    resource: 'categories'
  } as any;

  if (isSmall) {
    return (
      <Accordion sx={sx}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box display="flex" justifyContent="space-between" width="100%" mr={1}>
            <Typography sx={{ fontWeight: 'bold' }}>{title}</Typography>
            <Typography color="text.secondary">
              {new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(total)}
            </Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails sx={{ p: 0 }}>
          <ListContextProvider value={listContext}>
            <SimpleList
              primaryText={(record) => <CategoryShip cat={record} />}
              secondaryText={(record) => {
                const val = new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(record.value);
                if (record.budget) {
                  const budget = new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(record.budget);
                  return `${val} / ${budget}`;
                }
                return val;
              }}
              tertiaryText={(record) => <CategoryStatusChip record={record} type={type} />}
              linkType={false}
              sx={{
                '& .MuiListItem-root': {
                  paddingTop: 1,
                  paddingBottom: 1
                }
              }}
            />
          </ListContextProvider>
        </AccordionDetails>
      </Accordion>
    );
  }

  return (
    <Card sx={sx}>
      <CardContent>
        <Box>
          {title && (
            <Typography variant="h6" gutterBottom>
              {title}
            </Typography>
          )}
          <ListContextProvider value={listContext}>
            <Datagrid
              bulkActionButtons={false}
              rowClick={false}
              sx={{
                '& .RaDatagrid-headerCell': { fontWeight: 'bold' },
                '& .MuiTableCell-root': { padding: '8px 16px' }
              }}
            >
              <FunctionField
                label="app.category_summary.category"
                sortBy="name"
                render={(record: CategoryData) => <CategoryShip cat={record} />}
              />
              <NumberField
                source="value"
                label="app.category_summary.amount"
                options={{ style: 'currency', currency: 'EUR' }}
                textAlign="right"
              />
              <FunctionField
                label="app.category_summary.budget"
                sortBy="budget"
                textAlign="right"
                render={(record: CategoryData) => record.budget ? (
                  new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(record.budget)
                ) : '-'}
              />

              <FunctionField
                label="app.category_summary.status"
                textAlign="center"
                sortable={false}
                render={(record: CategoryData) => <CategoryStatusChip record={record} type={type} />}
              />
            </Datagrid>
          </ListContextProvider>

          {/* Total Footer */}
          <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', bgcolor: 'action.hover', borderTop: '1px solid rgba(224, 224, 224, 1)' }}>
            <Typography fontWeight="bold">{translate('app.category_summary.total')}</Typography>
            <Box display="flex" gap={4}>
              <Typography fontWeight="bold">
                {new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(total)}
              </Typography>
              {totalBudget > 0 && (
                <Typography fontWeight="bold" color="text.secondary">
                  Budget: {new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(totalBudget)}
                </Typography>
              )}
            </Box>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};
