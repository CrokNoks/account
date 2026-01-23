import { useMemo } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  CircularProgress,
  useTheme,
  Grid
} from '@mui/material';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { usePeriodReport } from '../reports/hooks/usePeriodReport';
import { formatCurrency } from '../../hooks/useFormatters';

interface BudgetVisualizationProps {
  periodId?: string | null;
}

export const BudgetVisualization = ({ periodId }: BudgetVisualizationProps) => {
  const theme = useTheme();

  // Get current period report data
  const { data: reportData, loading } = usePeriodReport(periodId || null);

  const chartData = useMemo(() => {
    if (!reportData?.categoryBreakdown) return [];

    return reportData.categoryBreakdown
      .filter(item => item.budgeted > 0) // Only include categories with budgets
      .map(item => ({
        name: item.category.name,
        color: item.category.color,
        budgeted: Math.abs(item.budgeted),
        spent: Math.abs(item.spent),
        remaining: Math.max(0, item.budgeted - Math.abs(item.spent)),
        percentage: item.budgeted > 0 ? Math.round((Math.abs(item.spent) / item.budgeted) * 100) : 0,
        type: item.type
      }))
      .sort((a, b) => b.spent - a.spent);
  }, [reportData]);

  const pieData = useMemo(() => {
    const totalBudgeted = chartData.reduce((sum, item) => sum + item.budgeted, 0);
    return chartData.map(item => ({
      name: item.name,
      value: item.budgeted,
      percentage: Math.round((item.budgeted / totalBudgeted) * 100),
      color: item.color
    }));
  }, [chartData]);

  const expenseData = useMemo(() => 
    chartData.filter(item => item.type === 'expense'),
    [chartData]
  );

  const incomeData = useMemo(() => 
    chartData.filter(item => item.type === 'income'),
    [chartData]
  );

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
            <Typography variant="body1" sx={{ ml: 2 }}>
              Chargement des visualisations budgétaires...
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (!reportData || chartData.length === 0) {
    return (
      <Card>
        <CardContent>
          <Box display="flex" flexDirection="column" alignItems="center" py={4}>
            <Typography variant="h6" gutterBottom color="text.secondary">
              Aucune donnée budgétaire disponible
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Définissez des budgets pour vos catégories pour voir les visualisations.
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <Box
          sx={{
            bgcolor: 'background.paper',
            p: 2,
            border: 1,
            borderColor: 'divider',
            borderRadius: 1
          }}
        >
          <Typography variant="body2" fontWeight="medium">
            {data.name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Budget: {formatCurrency(data.budgeted)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Dépensé: {formatCurrency(data.spent)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Pourcentage: {data.percentage}%
          </Typography>
        </Box>
      );
    }
    return null;
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Visualisations Budgétaires
      </Typography>
      
      <Grid container spacing={3}>
        {/* Budget Allocation Pie Chart */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Répartition du Budget
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name }) => `${name}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Budget vs Actual Bar Chart */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Budget vs Réel
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData.slice(0, 10)} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="name" 
                    angle={-45}
                    textAnchor="end"
                    height={100}
                    interval={0}
                    tick={{ fontSize: 10 }}
                  />
                  <YAxis tickFormatter={(value) => formatCurrency(value)} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="budgeted" fill={theme.palette.success.main} name="Budget" />
                  <Bar dataKey="spent" fill={theme.palette.error.main} name="Dépensé" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Expense Breakdown */}
        {expenseData.length > 0 && (
          <Grid size={{ xs: 12, md: 6 }}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom color="error.main">
                  Analyse des Dépenses
                </Typography>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={expenseData.slice(0, 8)} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="name" 
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      interval={0}
                      tick={{ fontSize: 10 }}
                    />
                    <YAxis tickFormatter={(value) => formatCurrency(value)} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar 
                      dataKey="percentage" 
                      fill={theme.palette.error.main} 
                      name="% Utilisé"
                      label={{ position: 'top' }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Income Analysis */}
        {incomeData.length > 0 && (
          <Grid size={{ xs: 12, md: 6 }}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom color="success.main">
                  Analyse des Revenus
                </Typography>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={incomeData.slice(0, 8)} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="name" 
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      interval={0}
                      tick={{ fontSize: 10 }}
                    />
                    <YAxis tickFormatter={(value) => formatCurrency(value)} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar 
                      dataKey="percentage" 
                      fill={theme.palette.success.main} 
                      name="% Atteint"
                      label={{ position: 'top' }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};