import { Card, CardContent, Typography, Grid, Tooltip, Box } from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';

interface ReportData {
  initialBalance: number;
  totalIncome: number;
  totalExpense: number;
  netResult: number;
  unreconciledBalance: number;
  pieData?: any[];
  incomePieData?: any[];
}

interface ReportSummaryCardsProps {
  reportData: ReportData;
  isSmall: boolean;
}

export const ReportSummaryCards = ({ reportData, isSmall }: ReportSummaryCardsProps) => {
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);

  return (
    <>
      {/* Initial Balance */}
      <Grid size={{ xs: 0, md: 2 }} sx={{ display: isSmall ? 'none' : 'grid' }}>
        <Card sx={{ bgcolor: 'action.hover', height: '100%' }}>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>Solde initial</Typography>
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
            <Typography color="textSecondary" gutterBottom>Flux</Typography>
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
      <Grid size={{ xs: 12, md: 2 }}>
        <Card sx={{
          bgcolor: (reportData.netResult - reportData.unreconciledBalance) >= 0 ? 'success.light' : 'error.light',
          color: (reportData.netResult - reportData.unreconciledBalance) >= 0 ? 'success.contrastText' : 'error.contrastText',
          height: '100%'
        }}>
          <CardContent>
            <Box display="flex" alignItems="center" gap={0.5}>
              <Typography color="inherit" gutterBottom>Solde banque</Typography>
              <Tooltip title="Solde pointé (correspondant à votre relevé bancaire actuel).">
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
      <Grid size={{ xs: 12, md: 2 }}>
        <Card sx={{ bgcolor: 'action.hover', height: '100%' }}>
          <CardContent>
            <Box display="flex" alignItems="center" gap={0.5}>
              <Typography color="inherit" gutterBottom>Opérations à venir</Typography>
              <Tooltip title="Total des opérations saisies mais non encore pointées (non débitées/créditées sur le compte).">
                <HelpOutlineIcon fontSize="small" sx={{ opacity: 0.7, mb: 0.5 }} />
              </Tooltip>
            </Box>
            <Typography variant="h5" color={reportData.unreconciledBalance >= 0 ? 'success.main' : 'error.main'}>
              {formatCurrency(reportData.unreconciledBalance)}
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      {/* Final Balance */}
      <Grid size={{ xs: 12, md: 2 }}>
        <Card sx={{
          bgcolor: reportData.netResult >= 0 ? 'success.light' : 'error.light',
          color: reportData.netResult >= 0 ? 'success.contrastText' : 'error.contrastText',
          height: '100%'
        }}>
          <CardContent>
            <Box display="flex" alignItems="center" gap={0.5}>
              <Typography color="inherit" gutterBottom>Solde final (Réel)</Typography>
              <Tooltip title="Solde réel en fin de période, basé sur toutes les opérations saisies (pointées et non pointées).">
                <HelpOutlineIcon fontSize="small" sx={{ opacity: 0.7, mb: 0.5 }} />
              </Tooltip>
            </Box>
            <Typography variant="h5" color="inherit" fontWeight="bold">
              {formatCurrency(reportData.netResult)}
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      {/* Projected Balance */}
      <Grid size={{ xs: 12, md: 2 }}>
        <Card sx={{ bgcolor: 'info.light', color: 'info.contrastText', height: '100%' }}>
          <CardContent>
            <Box display="flex" alignItems="center" gap={0.5}>
              <Typography color="inherit" gutterBottom>Solde prévisionnel</Typography>
              <Tooltip title="Estimation du solde final en prenant en compte les budgets définis pour les catégories, si ceux-ci sont supérieurs aux montants réels.">
                <HelpOutlineIcon fontSize="small" sx={{ opacity: 0.7, mb: 0.5 }} />
              </Tooltip>
            </Box>
            <Typography variant="h5" color="inherit" fontWeight="bold">
              {(() => {
                const projectedIncome = (reportData.incomePieData || []).reduce((sum: number, cat: any) => {
                  return sum + Math.max(cat.value, cat.budget || 0);
                }, 0);

                // If no income categories or budgets, fallback to totalIncome if it's greater than 0, else 0
                const finalProjectedIncome = projectedIncome > 0 ? projectedIncome : reportData.totalIncome;

                const projectedExpense = (reportData.pieData || []).reduce((sum: number, cat: any) => {
                  return sum + Math.max(cat.value, cat.budget || 0);
                }, 0);

                // If no expense categories or budgets, fallback to totalExpense
                const finalProjectedExpense = projectedExpense > 0 ? projectedExpense : reportData.totalExpense;

                const projectedBalance = reportData.initialBalance + finalProjectedIncome - finalProjectedExpense;

                return formatCurrency(projectedBalance);
              })()}
            </Typography>
          </CardContent>
        </Card>
      </Grid>
    </>
  );
};
