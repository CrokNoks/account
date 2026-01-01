import { Card, CardContent, Typography, Grid, Tooltip } from '@mui/material';
import { useTranslate } from 'react-admin';

interface ReportSummaryCardsProps {
  reportData: {
    initialBalance: number;
    bankBalance: number;
    futureBalance: number;
    projectedBalance: number;
    totalIncome: number;
    totalExpense: number;
    period: {
      is_active: boolean;
    };
  };
}

export const ReportSummaryCards = ({ reportData }: ReportSummaryCardsProps) => {
  const translate = useTranslate();

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);

  // Logical Sizing:
  // Active: 5 cards. Grid xs=12 md=4 (3 on first row, 2 on second).
  // Inactive: 4 cards (Projected hidden). Grid xs=12 md=3 (4 on first row).
  const gridSize = reportData.period.is_active ? 4 : 3;

  return (
    <>
      <Grid size={{ xs: 12, md: gridSize }}>
        <Card sx={{ height: '100%', bgcolor: 'background.paper' }}>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>
              {translate('app.dashboard.cards.initial_balance')}
            </Typography>
            <Typography variant="h5" color={reportData.initialBalance >= 0 ? 'success.main' : 'error.main'}>
              {formatCurrency(reportData.initialBalance)}
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      {/* Flux Card */}
      <Grid size={{ xs: 12, md: gridSize }}>
        <Tooltip title={translate('app.dashboard.tooltips.flux')}>
          <Card sx={{ height: '100%', bgcolor: 'background.paper' }}>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                {translate('app.dashboard.cards.flux')}
              </Typography>
              <Typography variant="body1" color="success.main" component="div">
                {translate('app.evolution.revenues')} : {formatCurrency(reportData.totalIncome)}
              </Typography>
              <Typography variant="body1" color="error.main" component="div">
                {translate('app.evolution.expenses')} : {formatCurrency(reportData.totalExpense)}
              </Typography>
            </CardContent>
          </Card>
        </Tooltip>
      </Grid>

      <Grid size={{ xs: 12, md: gridSize }}>
        <Tooltip title={translate('app.dashboard.tooltips.bank_balance')}>
          <Card sx={{ height: '100%', bgcolor: 'background.paper' }}>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                {translate('app.dashboard.cards.bank_balance')}
              </Typography>
              <Typography variant="h5" color={reportData.bankBalance >= 0 ? 'success.main' : 'error.main'}>
                {formatCurrency(reportData.bankBalance)}
              </Typography>
            </CardContent>
          </Card>
        </Tooltip>
      </Grid>

      {reportData.period.is_active && (<>
        <Grid size={{ xs: 12, md: gridSize }}>
          <Tooltip title={translate('app.dashboard.tooltips.operations_balance')}>
            <Card sx={{ height: '100%', bgcolor: 'background.paper' }}>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  {translate('app.dashboard.cards.operations_balance')} ({translate('app.dashboard.cards.pending')})
                </Typography>
                <Typography variant="h5" color={reportData.futureBalance >= 0 ? 'success.main' : 'error.main'}>
                  {formatCurrency(reportData.futureBalance)}
                </Typography>
              </CardContent>
            </Card>
          </Tooltip>
        </Grid>

        <Grid size={{ xs: 12, md: gridSize }}>
          <Tooltip title={translate('app.dashboard.tooltips.projected_balance')}>
            <Card sx={{ height: '100%', bgcolor: (reportData.projectedBalance) >= 0 ? 'success.light' : 'error.light', color: (reportData.projectedBalance) >= 0 ? 'success.contrastText' : 'error.contrastText' }}>
              <CardContent>
                <Typography color="inherit" gutterBottom>
                  {translate('app.dashboard.cards.projected_balance')}
                </Typography>
                <Typography variant="h5" fontWeight="bold">
                  {formatCurrency(reportData.projectedBalance)}
                </Typography>
              </CardContent>
            </Card>
          </Tooltip>
        </Grid>
      </>
      )}
    </>
  );
};
