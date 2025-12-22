import { useState } from 'react';
import { Card, CardContent, Typography, Grid, Tooltip, Box, TextField } from '@mui/material';
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

  // Default forecast date: End of current month
  const [forecastDate, setForecastDate] = useState(() => {
    const now = new Date();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return endOfMonth.toISOString().split('T')[0];
  });

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
              <Box display="flex" flexDirection="column" gap={0.5}>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box display="flex" alignItems="center" gap={0.5}>
                    <Typography color="inherit" variant="caption" gutterBottom>{translate('app.dashboard.cards.projected_balance')}</Typography>
                    <Tooltip title={translate('app.dashboard.tooltips.projected_balance')}>
                      <HelpOutlineIcon fontSize="small" sx={{ opacity: 0.7 }} />
                    </Tooltip>
                  </Box>
                  {/* Date Picker for Forecast */}
                  <TextField
                    type="date"
                    variant="standard"
                    size="small"
                    value={forecastDate}
                    onChange={(e) => setForecastDate(e.target.value)}
                    sx={{
                      input: { color: 'inherit', fontSize: '0.8rem', padding: '0 4px' },
                      '& .MuiInput-underline:before': { borderBottomColor: 'rgba(255,255,255,0.5)' },
                      '& .MuiInput-underline:hover:not(.Mui-disabled):before': { borderBottomColor: 'white' },
                      '& .MuiInput-underline:after': { borderBottomColor: 'white' }
                    }}
                  />
                </Box>
                {(() => {
                  let projectedBalance = reportData.initialBalance;
                  let diff = 0;

                  // Use raw expenses if available for precise date filtering (User Request)
                  if (reportData.rawExpenses) {
                    // Filter ops <= forecastDate
                    const relevantOps = reportData.rawExpenses.filter((exp: any) => {
                      if (!exp.date) return false;
                      // Compare strings YYYY-MM-DD
                      return exp.date.split('T')[0] <= forecastDate;
                    });

                    let income = 0;
                    let expense = 0;

                    relevantOps.forEach((e: any) => {
                      const amount = Number(e.amount);
                      if (amount > 0) income += amount;
                      else expense += Math.abs(amount);
                    });

                    projectedBalance = reportData.initialBalance + income - expense;
                    diff = projectedBalance - reportData.initialBalance;
                  } else {
                    // Fallback to "current state" (Net Result) if raw data missing
                    projectedBalance = reportData.netResult;
                    diff = projectedBalance - reportData.initialBalance;
                  }

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
              </Box>
            </CardContent>
          </Card>
        </Grid>
      )}
    </Grid>
  );
};
