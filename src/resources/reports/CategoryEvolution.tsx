import { useState, useEffect } from 'react';
import { useNotify } from 'react-admin';
import { CircularProgress } from '@mui/material';
import {
  Card, CardContent, Typography, Box, FormControl, InputLabel, Select, MenuItem, Grid
} from '@mui/material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useAccount } from '../../context/AccountContext';
import { supabaseClient } from '../../supabaseClient';
import { useIsSmall } from '../../hooks/isSmall';

interface CategoryData {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  totalExpense: number;
  totalRevenue: number;
  reportCount: number;
  min: number;
  max: number;
}

interface ReportPoint {
  reportId: string;
  reportLabel: string;
  [key: string]: any; // For dynamic category amounts
}

const getFirstAndLastReport = (reports: any[]) => {
  if (reports.length === 0) return { firstReport: null, lastReport: null };
  const firstReport = reports[0];
  const lastReport = reports[reports.length - 1];
  return { firstReport: firstReport.start_date, lastReport: lastReport.end_date };
}

export const CategoryEvolution = () => {
  const { selectedAccountId } = useAccount();
  const notify = useNotify();
  const isSmall = useIsSmall();
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState<any[]>([]);
  const [categoryData, setCategoryData] = useState<CategoryData[]>([]);
  const [chartData, setChartData] = useState<ReportPoint[]>([]);
  const [selectedView, setSelectedView] = useState<'expenses' | 'revenues'>('expenses');
  const [firstReport, setFirstReport] = useState<string | null>(null);
  const [lastReport, setLastReport] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!selectedAccountId) return;

      setLoading(true);
      try {
        // Fetch all archived reports
        const { data: reportsData, error: reportsError } = await supabaseClient
          .from('reports')
          .select('id, start_date, end_date, data')
          .eq('account_id', selectedAccountId)
          .order('end_date', { ascending: true });

        if (reportsError) throw reportsError;

        if (!reportsData || reportsData.length === 0) {
          notify('Aucun rapport archivé trouvé', { type: 'info' });
          setLoading(false);
          return;
        }

        setReports(reportsData);

        const { firstReport, lastReport } = getFirstAndLastReport(reportsData);
        setFirstReport(firstReport);
        setLastReport(lastReport);

        // Aggregate category data across all reports
        const categoryMap = new Map<string, CategoryData>();
        const chartPoints: ReportPoint[] = [];

        reportsData.forEach((report: any) => {
          const reportLabel = `${new Date(report.start_date).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })} - ${new Date(report.end_date).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })}`;
          const point: ReportPoint = {
            reportId: report.id,
            reportLabel
          };

          // Process pie data from report
          if (report.data?.pieData && Array.isArray(report.data.pieData)) {
            report.data.pieData.forEach((cat: any) => {
              const catKey = cat.name || 'Sans catégorie';
              const catColor = cat.color || '#ccc';
              const catValue = cat.value || 0;

              // Update category summary
              if (!categoryMap.has(catKey)) {
                categoryMap.set(catKey, {
                  categoryId: catKey,
                  categoryName: catKey,
                  categoryColor: catColor,
                  totalExpense: 0,
                  totalRevenue: 0,
                  reportCount: 0,
                  min: Infinity,
                  max: -Infinity
                });
              }

              const catData = categoryMap.get(catKey)!;
              catData.totalExpense += catValue;
              catData.reportCount++;
              catData.min = Math.min(catData.min, catValue);
              catData.max = Math.max(catData.max, catValue);

              // Add to chart point
              point[`expense_${catKey}`] = catValue;
            });
          }

          // Process revenues (positive amounts)
          const totalRevenue = report.data?.totalIncome || 0;
          point['revenue_Total'] = totalRevenue;

          chartPoints.push(point);
        });

        setCategoryData(Array.from(categoryMap.values()).sort((a, b) => a.categoryName.localeCompare(b.categoryName)));
        setChartData(chartPoints);

      } catch (error: any) {
        console.error('Error fetching evolution data:', error);
        notify(`Erreur: ${error.message}`, { type: 'error' });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedAccountId, notify]);

  if (!selectedAccountId) {
    return <Box p={2}>Veuillez sélectionner un compte.</Box>;
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
        <Typography variant="h5" gutterBottom>Évolution par Catégorie</Typography>
        <Typography color="text.secondary">
          Aucun rapport archivé disponible. Clôturez au moins un rapport pour voir l'évolution.
        </Typography>
      </Box>
    );
  }

  return (
    <Box p={2}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5">Évolution par Catégorie</Typography>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Vue</InputLabel>
          <Select
            value={selectedView}
            label="Vue"
            onChange={(e) => setSelectedView(e.target.value as 'expenses' | 'revenues')}
          >
            <MenuItem value="expenses">Dépenses</MenuItem>
            <MenuItem value="revenues">Revenus</MenuItem>
          </Select>
        </FormControl>
      </Box>

      <Grid container spacing={3}>
        {/* Global Statistics */}
        <Grid size={{ xs: 12 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Statistiques Globales
              </Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Typography color="text.secondary" variant="body2">
                    {isSmall ? 'Période analysée' : `Nombre de Rapports du ${firstReport ? new Date(firstReport).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }) : ''} au ${lastReport ? new Date(lastReport).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }) : ''}`}
                  </Typography>
                  <Typography variant="h6">
                    {isSmall
                      ? `${firstReport ? new Date(firstReport).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }) : ''} - ${lastReport ? new Date(lastReport).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }) : ''}`
                      : reports.length
                    }
                  </Typography>
                </Grid>
                {!isSmall && (
                  <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <Typography color="text.secondary" variant="body2">
                      Catégories Actives
                    </Typography>
                    <Typography variant="h6">
                      {categoryData.length}
                    </Typography>
                  </Grid>
                )}
                <Grid size={{ xs: 6, sm: 6, md: 3 }}>
                  <Typography color="text.secondary" variant="body2">
                    Dépenses Totales
                  </Typography>
                  <Typography variant="h6" color="error">
                    {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(
                      categoryData.reduce((sum, cat) => sum + cat.totalExpense, 0)
                    )}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 6, sm: 6, md: 3 }}>
                  <Typography color="text.secondary" variant="body2">
                    Revenus Totaux
                  </Typography>
                  <Typography variant="h6" color="primary">
                    {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(
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
                {selectedView === 'expenses' ? 'Résumé des Dépenses' : 'Résumé des Revenus'}
              </Typography>
              {selectedView === 'expenses' ? (
                <Box>
                  {categoryData.map((cat) => (
                    <Box key={cat.categoryId} mb={2}>
                      <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                        <Box
                          sx={{
                            width: 16,
                            height: 16,
                            bgcolor: cat.categoryColor,
                            borderRadius: 1
                          }}
                        />
                        <Typography variant="body2" fontWeight="bold">
                          {cat.categoryName}
                        </Typography>
                      </Box>
                      <Box display="flex" justifyContent="space-between" mt={1} bgcolor="action.hover" p={1} borderRadius={1}>
                        <Box textAlign="center">
                          <Typography variant="caption" color="text.secondary" display="block">Total</Typography>
                          <Typography variant="body2" fontWeight="bold">
                            {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(cat.totalExpense)}
                          </Typography>
                        </Box>
                        <Box textAlign="center">
                          <Typography variant="caption" color="text.secondary" display="block">Min</Typography>
                          <Typography variant="body2">
                            {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(cat.min)}
                          </Typography>
                        </Box>
                        <Box textAlign="center">
                          <Typography variant="caption" color="text.secondary" display="block">Moy</Typography>
                          <Typography variant="body2">
                            {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(cat.totalExpense / cat.reportCount)}
                          </Typography>
                        </Box>
                        <Box textAlign="center">
                          <Typography variant="caption" color="text.secondary" display="block">Max</Typography>
                          <Typography variant="body2">
                            {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(cat.max)}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                  ))}
                </Box>
              ) : (
                <Box>
                  <Typography variant="body2" fontWeight="bold" mb={1}>
                    Revenus Totaux
                  </Typography>
                  {chartData.map((point) => (
                    <Box key={point.reportId} mb={1}>
                      <Typography variant="body2">
                        {point.reportLabel}
                      </Typography>
                      <Typography variant="body2" color="primary">
                        {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(point['revenue_Total'] || 0)}
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
                  Évolution dans le Temps
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
                      formatter={(value: any) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value)}
                    />
                    <Legend />
                    {selectedView === 'expenses' ? (
                      categoryData.map((cat) => (
                        <Line
                          key={cat.categoryId}
                          type="monotone"
                          dataKey={`expense_${cat.categoryName}`}
                          name={cat.categoryName}
                          stroke={cat.categoryColor}
                          strokeWidth={2}
                          dot={{ r: 4 }}
                        />
                      ))
                    ) : (
                      <Line
                        type="monotone"
                        dataKey="revenue_Total"
                        name="Revenus"
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
    </Box>
  );
};
