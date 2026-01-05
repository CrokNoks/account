import { useState, useEffect } from 'react';
import { useTranslate, useLocale } from 'react-admin';
import { CircularProgress } from '@mui/material';
import {
  Card, CardContent, Typography, Box, FormControl, InputLabel, Select, MenuItem, Grid, Checkbox, Slider
} from '@mui/material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useAccount } from '../../context/AccountContext';
import { useIsSmall } from '../../hooks/isSmall';
import { CategoryShip } from '../../components/CategoryShip';
import { useCategoryEvolution } from './hooks/useCategoryEvolution';

export const CategoryEvolution = () => {
  const { selectedAccountId } = useAccount();
  const isSmall = useIsSmall();
  const translate = useTranslate();
  const locale = useLocale();
  const [selectedView, setSelectedView] = useState<'expenses' | 'revenues'>('expenses');
  const [varianceFilter, setVarianceFilter] = useState<'all' | 'stable' | 'variable'>('all');
  const [varianceThreshold, setVarianceThreshold] = useState<number>(5);

  const {
    loading,
    reports,
    categoryData,
    chartData,
    firstReport,
    lastReport
  } = useCategoryEvolution();

  const [hiddenCategories, setHiddenCategories] = useState<string[]>([]);

  const toggleCategory = (categoryId: string) => {
    setHiddenCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  useEffect(() => {
    if (categoryData && categoryData.length > 5) {
      const isVariable = (c: typeof categoryData[0]) => {
        if (c.min === c.max) return false;
        if (c.min === 0) return true; // Any change from 0 is significant
        return c.max > (c.min * (1 + varianceThreshold / 100));
      };

      // 1. Separate variable and stable categories
      const variableCats = categoryData.filter(isVariable);
      const stableCats = categoryData.filter(c => !isVariable(c));

      // 2. Sort both lists by total expense descending
      variableCats.sort((a, b) => b.totalExpense - a.totalExpense);
      stableCats.sort((a, b) => b.totalExpense - a.totalExpense);

      // 3. Select top 5 starting with variable ones
      let top5: string[] = [];

      // Take up to 5 variable categories
      top5 = variableCats.slice(0, 5).map(c => c.categoryId);

      // If we don't have 5 yet, fill with stable categories
      if (top5.length < 5) {
        const remainingSlots = 5 - top5.length;
        top5 = [...top5, ...stableCats.slice(0, remainingSlots).map(c => c.categoryId)];
      }

      // 4. Determine which categories to hide (all except the top 5 selected)
      const allCategoryIds = categoryData.map(c => c.categoryId);
      const toHide = allCategoryIds.filter(id => !top5.includes(id));

      setHiddenCategories(prev => {
        // If this is a purely automatic update (e.g. initial load or threshold change seeking new defaults), we might want to override.
        // However, simply overriding 'prev' might discard user's manual toggles.
        // But for the purpose of "seeing the effect of threshold", we probably want to re-apply the logic.
        // Let's just return the new toHide list to refresh the view based on new definition.
        return toHide;
      });
    }
  }, [categoryData, varianceThreshold]);

  if (!selectedAccountId) {
    return <Box p={2}>{translate('app.messages.no_account')}</Box>;
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  if (reports.length === 0) {
    return (
      <Box p={2}>
        <Typography variant="h5" gutterBottom>{translate('app.evolution.title')}</Typography>
        <Typography color="text.secondary">
          {translate('app.evolution.no_reports')}
        </Typography>
      </Box>
    );
  }

  return (
    <Box p={2}>
      <Box display="flex" flexDirection={isSmall ? 'column' : 'row'} justifyContent="space-between" alignItems={isSmall ? 'flex-start' : 'center'} mb={3} gap={2}>
        <Typography variant="h5">{translate('app.evolution.title')}</Typography>
        <Box display="flex" flexDirection={isSmall ? 'column' : 'row'} gap={2} width={isSmall ? '100%' : 'auto'}>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>{translate('app.evolution.view')}</InputLabel>
            <Select
              value={selectedView}
              label={translate('app.evolution.view')}
              onChange={(e) => setSelectedView(e.target.value as 'expenses' | 'revenues')}
            >
              <MenuItem value="expenses">{translate('app.evolution.expenses')}</MenuItem>
              <MenuItem value="revenues">{translate('app.evolution.revenues')}</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>{translate('app.evolution.variance.label')}</InputLabel>
            <Select
              value={varianceFilter}
              label={translate('app.evolution.variance.label')}
              onChange={(e) => setVarianceFilter(e.target.value as 'all' | 'stable' | 'variable')}
            >
              <MenuItem value="all">{translate('app.evolution.variance.all')}</MenuItem>
              <MenuItem value="stable">{translate('app.evolution.variance.stable')}</MenuItem>
              <MenuItem value="variable">{translate('app.evolution.variance.variable')}</MenuItem>
            </Select>
          </FormControl>
          <Box sx={{ width: 250, px: 2 }}> {/* Widened slider container */}
            <Typography variant="caption" color="text.secondary" gutterBottom>
              {translate('app.evolution.variance.threshold')} ({varianceThreshold}%)
            </Typography>
            <Slider
              value={varianceThreshold}
              onChange={(_, value) => setVarianceThreshold(value as number)}
              min={0}
              max={50}
              valueLabelDisplay="auto"
            />
          </Box>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Global Statistics */}
        <Grid size={{ xs: 12 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {translate('app.evolution.global_stats')}
              </Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Typography color="text.secondary" variant="body2">
                    {isSmall ? translate('app.evolution.period_analyzed') : `${translate('resources.reports.name', { smart_count: 2 })} ${firstReport ? new Date(firstReport).toLocaleDateString(locale, { month: 'short', year: '2-digit' }) : ''} - ${lastReport ? new Date(lastReport).toLocaleDateString(locale, { month: 'short', year: '2-digit' }) : ''}`}
                  </Typography>
                  <Typography variant="h6">
                    {isSmall
                      ? `${firstReport ? new Date(firstReport).toLocaleDateString(locale, { month: 'short', year: '2-digit' }) : ''} - ${lastReport ? new Date(lastReport).toLocaleDateString(locale, { month: 'short', year: '2-digit' }) : ''}`
                      : reports.length
                    }
                  </Typography>
                </Grid>
                {!isSmall && (
                  <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <Typography color="text.secondary" variant="body2">
                      {translate('app.evolution.active_categories')}
                    </Typography>
                    <Typography variant="h6">
                      {categoryData.length}
                    </Typography>
                  </Grid>
                )}
                <Grid size={{ xs: 6, sm: 6, md: 3 }}>
                  <Typography color="text.secondary" variant="body2">
                    {translate('app.evolution.total_expenses')}
                  </Typography>
                  <Typography variant="h6" color="error">
                    {new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(
                      categoryData.reduce((sum, cat) => sum + cat.totalExpense, 0)
                    )}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 6, sm: 6, md: 3 }}>
                  <Typography color="text.secondary" variant="body2">
                    {translate('app.evolution.total_revenues')}
                  </Typography>
                  <Typography variant="h6" color="primary">
                    {new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(
                      chartData.reduce((sum, point) => sum + (point['revenue_Total'] || 0), 0)
                    )}
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Summary Table */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {selectedView === 'expenses' ? translate('app.evolution.summary_expenses') : translate('app.evolution.summary_revenues')}
              </Typography>
              {selectedView === 'expenses' ? (
                <Box>
                  {categoryData
                    .filter(cat => {
                      const isVariable = cat.min !== cat.max && (cat.min === 0 || cat.max > cat.min * (1 + varianceThreshold / 100));

                      if (varianceFilter === 'stable') return !isVariable;
                      if (varianceFilter === 'variable') return isVariable;
                      return true;
                    })
                    .map((cat) => (
                      <Box key={cat.categoryId} mb={2}>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Checkbox
                            size="small"
                            checked={!hiddenCategories.includes(cat.categoryId)}
                            onChange={() => toggleCategory(cat.categoryId)}
                            sx={{ p: 0.5, color: cat.color, '&.Mui-checked': { color: cat.color } }}
                          />
                          <Box flexGrow={1}>
                            <CategoryShip cat={cat} />
                          </Box>
                        </Box>
                        {!hiddenCategories.includes(cat.categoryId) && (
                          <Box display="flex" justifyContent="space-between" mt={1} bgcolor="action.hover" p={1} borderRadius={1}>
                            <Box textAlign="center">
                              <Typography variant="caption" color="text.secondary" display="block">{translate('app.evolution.stats.total')}</Typography>
                              <Typography variant="body2" fontWeight="bold">
                                {new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(cat.totalExpense)}
                              </Typography>
                            </Box>
                            <Box textAlign="center">
                              <Typography variant="caption" color="text.secondary" display="block">{translate('app.evolution.stats.min')}</Typography>
                              <Typography variant="body2">
                                {new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(cat.min)}
                              </Typography>
                            </Box>
                            <Box textAlign="center">
                              <Typography variant="caption" color="text.secondary" display="block">{translate('app.evolution.stats.avg')}</Typography>
                              <Typography variant="body2">
                                {new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(cat.totalExpense / cat.reportCount)}
                              </Typography>
                            </Box>
                            <Box textAlign="center">
                              <Typography variant="caption" color="text.secondary" display="block">{translate('app.evolution.stats.max')}</Typography>
                              <Typography variant="body2">
                                {new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(cat.max)}
                              </Typography>
                            </Box>
                            <Box textAlign="center">
                              <Typography variant="caption" color="text.secondary" display="block">{translate('app.evolution.variance.label')}</Typography>
                              <Typography variant="body2" sx={{ color: (cat.max > cat.min * (1 + varianceThreshold / 100)) ? 'warning.main' : 'text.primary' }}>
                                {cat.min > 0
                                  ? `${Math.round(((cat.max - cat.min) / cat.min) * 100)}%`
                                  : (cat.max > 0 ? '∞' : '0%')}
                              </Typography>
                            </Box>
                          </Box>
                        )}
                      </Box>
                    ))}
                </Box>
              ) : (
                <Box>
                  <Typography variant="body2" fontWeight="bold" mb={1}>
                    {translate('app.evolution.total_revenues')}
                  </Typography>
                  {chartData.map((point) => (
                    <Box key={point.reportId} mb={1}>
                      <Typography variant="body2">
                        {point.reportLabel}
                      </Typography>
                      <Typography variant="body2" color="primary">
                        {new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(point['revenue_Total'] || 0)}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Chart */}
        {!isSmall && (
          <Grid size={{ xs: 12, md: 8 }}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {translate('app.evolution.chart_title')}
                </Typography>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="reportLabel"
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis />
                    <Tooltip
                      formatter={(value: any) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(value)}
                    />
                    <Legend />
                    {selectedView === 'expenses' ? (
                      categoryData
                        .filter(cat => !hiddenCategories.includes(cat.categoryId))
                        .filter(cat => {
                          const isVariable = cat.min !== cat.max && (cat.min === 0 || cat.max > cat.min * (1 + varianceThreshold / 100));

                          if (varianceFilter === 'stable') return !isVariable;
                          if (varianceFilter === 'variable') return isVariable;
                          return true;
                        })
                        .map((cat) => (
                          <Line
                            key={cat.categoryId}
                            type="monotone"
                            dataKey={`expense_${cat.name}`}
                            name={cat.name}
                            stroke={cat.color}
                            strokeWidth={2}
                            dot={{ r: 4 }}
                          />
                        ))
                    ) : (
                      <Line
                        type="monotone"
                        dataKey="revenue_Total"
                        name={translate('app.evolution.revenues')}
                        stroke="#4caf50"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>
    </Box >
  );
};
