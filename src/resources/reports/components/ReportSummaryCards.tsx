import { Card, CardContent, Typography, Grid, Tooltip, Box } from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import { useTranslate, useLocale } from 'react-admin';

interface ReportSummaryCardsProps {
  reportData: ReportData;
  isSmall: boolean;
  isClosed?: boolean;
}

export const ReportSummaryCards = ({ reportData, isSmall, isClosed = false }: ReportSummaryCardsProps) => {
  const translate = useTranslate();
  const locale = useLocale();

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(amount);

  return (

    <Grid container spacing={3}>
      {/* Initial Balance */}
      <Grid size={{ xs: 6, md: 2 }} sx={{ display: (isSmall && !isClosed) ? 'none' : 'grid' }}>
        <Card sx={{ bgcolor: 'action.hover', height: '100%' }}>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>{translate('app.dashboard.cards.initial_balance')}</Typography>
            <Typography variant="h5" color={reportData.initialBalance >= 0 ? 'success.main' : 'error.main'}>
              {formatCurrency(reportData.initialBalance)}
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      {/* Flux */}
      <Grid size={{ xs: 0, md: 2 }} sx={{ display: isSmall ? 'none' : 'grid' }}>
        <Card sx={{ bgcolor: 'background.paper', height: '100%' }}>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>{translate('app.dashboard.cards.flux')}</Typography>
            <Box display="flex" flexDirection="column">
              <Typography variant="body1" color="success.main" fontWeight="bold">
                + {formatCurrency(reportData.totalIncome)}
              </Typography>
              <Typography variant="body1" color="error.main" fontWeight="bold">
                - {formatCurrency(reportData.totalExpense)}
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Grid>

      {/* Bank Balance */}
      <Grid size={{ xs: 6, md: 2 }}>
        <Card sx={{
          bgcolor: (reportData.netResult - reportData.unreconciledBalance) >= 0 ? 'success.light' : 'error.light',
          color: (reportData.netResult - reportData.unreconciledBalance) >= 0 ? 'success.contrastText' : 'error.contrastText',
          height: '100%'
        }}>
          <CardContent>
            <Box display="flex" alignItems="center" gap={0.5}>
              <Typography color="inherit" gutterBottom>{translate('app.dashboard.cards.bank_balance')}</Typography>
              <Tooltip title={translate('app.dashboard.tooltips.bank_balance')}>
                <HelpOutlineIcon fontSize="small" sx={{ opacity: 0.7, mb: 0.5 }} />
              </Tooltip>
            </Box>
            <Typography variant="h5" color="inherit" fontWeight="bold">
              {formatCurrency(reportData.netResult - reportData.unreconciledBalance)}
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      {/* Pending Operations */}
      {!isClosed && (
        <Grid size={{ xs: 6, md: 2 }}>
          <Card sx={{ bgcolor: 'action.hover', height: '100%' }}>
            <CardContent>
              <Box display="flex" alignItems="center" gap={0.5}>
                <Typography color="inherit" gutterBottom>{translate('app.dashboard.cards.pending')}</Typography>
                <Tooltip title={translate('app.dashboard.tooltips.pending')}>
                  <HelpOutlineIcon fontSize="small" sx={{ opacity: 0.7, mb: 0.5 }} />
                </Tooltip>
              </Box>
              <Typography variant="h5" color={reportData.unreconciledBalance >= 0 ? 'success.main' : 'error.main'}>
                {formatCurrency(reportData.unreconciledBalance)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      )}

      {/* Final Balance */}
      {!isClosed && (
        <Grid size={{ xs: 6, md: 2 }}>
          <Card sx={{
            bgcolor: reportData.netResult >= 0 ? 'success.light' : 'error.light',
            color: reportData.netResult >= 0 ? 'success.contrastText' : 'error.contrastText',
            height: '100%'
          }}>
            <CardContent>
              <Box display="flex" alignItems="center" gap={0.5}>
                <Typography color="inherit" gutterBottom>{translate('app.dashboard.cards.operations_balance')}</Typography>
                <Tooltip title={translate('app.dashboard.tooltips.operations_balance')}>
                  <HelpOutlineIcon fontSize="small" sx={{ opacity: 0.7, mb: 0.5 }} />
                </Tooltip>
              </Box>
              <Typography variant="h5" color="inherit" fontWeight="bold">
                {formatCurrency(reportData.netResult)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      )}

      {/* Projected Balance */}
      {!isClosed && (
        <Grid size={{ xs: 6, md: 2 }}>
          <Card sx={{ bgcolor: 'info.light', color: 'info.contrastText', height: '100%' }}>
            <CardContent>
              <Box display="flex" alignItems="center" gap={0.5}>
                <Typography color="inherit" gutterBottom>{translate('app.dashboard.cards.projected_balance')}</Typography>
                <Tooltip title={translate('app.dashboard.tooltips.projected_balance')}>
                  <HelpOutlineIcon fontSize="small" sx={{ opacity: 0.7, mb: 0.5 }} />
                </Tooltip>
              </Box>
              {(() => {
                const projectedIncome = (reportData.incomePieData || []).reduce((sum: number, cat: any) => {
                  return sum + Math.max(cat.value, cat.budget || 0);
                }, 0);

                // If no income categories or budgets, fallback to totalIncome if it's greater than 0, else 0
                const finalProjectedIncome = projectedIncome > 0 ? projectedIncome : reportData.totalIncome;

                const projectedExpense = (reportData.expensePieData || []).reduce((sum: number, cat: any) => {
                  return sum + Math.max(cat.value, cat.budget || 0);
                }, 0);

                // If no expense categories or budgets, fallback to totalExpense
                const finalProjectedExpense = projectedExpense > 0 ? projectedExpense : reportData.totalExpense;

                const projectedBalance = reportData.initialBalance + finalProjectedIncome - finalProjectedExpense;
                const diff = projectedBalance - reportData.initialBalance;
                const isPositive = diff >= 0;

                return (
                  <Box>
                    <Typography variant="h5" color="inherit" fontWeight="bold">
                      {formatCurrency(projectedBalance)}
                    </Typography>
                    <Box display="flex" alignItems="center" gap={0.5} mt={0.5} sx={{ opacity: 0.9 }}>
                      {isPositive ? (
                        <TrendingUpIcon fontSize="small" sx={{ color: 'success.main' }} />
                      ) : (
                        <TrendingDownIcon fontSize="small" sx={{ color: 'error.main' }} />
                      )}
                      <Typography variant="body2" color={isPositive ? 'success.main' : 'error.main'} fontWeight="bold">
                        {isPositive ? '+' : ''}{formatCurrency(diff)}
                      </Typography>
                    </Box>
                  </Box>
                );
              })()}
            </CardContent>
          </Card>
        </Grid>
      )}
    </Grid>
  );
};
