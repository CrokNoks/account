import { useState } from 'react';
import { useTranslate, useLocale } from 'react-admin';
import { CircularProgress } from '@mui/material';
import {
  Card, CardContent, Typography, Box, FormControl, InputLabel, Select, MenuItem, Grid
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

  const {
    loading,
    reports,
    categoryData,
    chartData,
    firstReport,
    lastReport
  } = useCategoryEvolution();

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
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5">{translate('app.evolution.title')}</Typography>
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
                  {categoryData.map((cat) => (
                    <Box key={cat.categoryId} mb={2}>
                      <CategoryShip cat={cat} />
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
                      </Box>
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
                      categoryData.map((cat) => (
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
