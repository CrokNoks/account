import { useState } from 'react';
import { useNotify, Loading } from 'react-admin';
import { Card, CardContent, Typography, Grid, Box, Button } from '@mui/material';
import { useAccount } from '../../context/AccountContext';
import { CategorySummaryTable } from '../../components/CategorySummaryTable';
import { ExpenseList } from '../expenses';
import { useIsSmall } from '../../hooks/isSmall';
import {
  ReportSummaryCards,
  ReportSelector,
  CreateReportModal,
  CloseReportModal,
  AddExpenseDrawer
} from './components';
import { useReportData } from './hooks/useReportData';
import { useReportActions } from './hooks/useReportActions';

const getFilter = ({ date_gte, date_lte }: { date_gte: string | null, date_lte: string }) => {
  const filter: any = {
    date_gte
  };
  if (date_lte) {
    filter.date_lte = date_lte;
  }
  return filter;
}

export const ReportDashboard = () => {
  const { selectedAccountId } = useAccount();
  const notify = useNotify();
  const isSmall = useIsSmall();

  // Expense Drawer state
  const [isExpenseDrawerOpen, setExpenseDrawerOpen] = useState(false);

  // Use custom hooks
  const {
    loading,
    setLoading,
    reportData,
    setReportData,
    history,
    selectedReportId,
    setSelectedReportId,
    fetchAndCalculateReport,
    loadCurrentReport,
    refreshCurrentReport,
    fetchHistory
  } = useReportData(selectedAccountId);

  const {
    isCreateModalOpen,
    setCreateModalOpen,
    newReportParams,
    setNewReportParams,
    handleGenerateReport,
    isCloseModalOpen,
    setCloseModalOpen,
    closingDate,
    setClosingDate,
    handleOpenCloseModal,
    handleConfirmCloseReport,
    handleDeleteReport
  } = useReportActions(
    selectedAccountId,
    fetchAndCalculateReport,
    fetchHistory,
    setReportData,
    setSelectedReportId,
    setLoading
  );

  const handleReportChange = (reportId: string) => {
    if (reportId === 'new') {
      setSelectedReportId('new');
      loadCurrentReport();
    } else {
      setSelectedReportId(reportId);
    }
  };

  const handleExpenseSuccess = () => {
    notify('Opération ajoutée', { type: 'success' });
    setExpenseDrawerOpen(false);
    refreshCurrentReport();
  };

  if (!selectedAccountId) {
    return (
      <Box p={2}>
        <Typography variant="h6" gutterBottom>
          Aucun compte sélectionné
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Choisissez un compte en haut de l&apos;écran pour afficher vos rapports et vos
          opérations.
        </Typography>
      </Box>
    );
  }
  if (loading) return <Loading />;

  return (
    <Box p={2}>
      <Box
        display="flex"
        flexDirection={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', md: 'center' }}
        gap={2}
        mb={2}
      >
        <ReportSelector
          selectedReportId={selectedReportId}
          history={history}
          onReportChange={handleReportChange}
        />

        <Box display="flex" gap={1} justifyContent={{ xs: 'flex-end', md: 'flex-start' }}>
          {selectedReportId === 'new' && (
            <Button variant="contained" color="secondary" onClick={() => handleOpenCloseModal(reportData)}>
              Clôturer
            </Button>
          )}
          {selectedReportId && selectedReportId !== 'new' && (
            <>
              <Button variant="contained" color="primary" onClick={() => setCreateModalOpen(true)}>
                Nouveau Rapport
              </Button>
              <Button variant="outlined" color="error" onClick={() => handleDeleteReport(selectedReportId)}>
                Supprimer
              </Button>
            </>
          )}
        </Box>
      </Box>

      {reportData ? (
        <Grid container spacing={3}>
          {/* Header Info */}
          <Grid size={{ xs: 12 }}>
            <Typography variant="subtitle1" color="text.secondary" align="center">
              Période du {new Date(reportData.startDate).toLocaleDateString('fr-FR')}
              {reportData.endDate
                ? ` au ${new Date(reportData.endDate).toLocaleDateString('fr-FR')}`
                : ' à aujourd\'hui (En cours)'}
            </Typography>
          </Grid>

          {/* Summary Cards */}
          <ReportSummaryCards reportData={reportData} isSmall={isSmall} />

          {/* Category Tables - LEFT COLUMN */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Card>
              <CardContent>
                <CategorySummaryTable
                  data={reportData.pieData}
                  title="Dépenses par catégorie"
                  type="expense"
                />
              </CardContent>
            </Card>

            {reportData.incomePieData && reportData.incomePieData.length > 0 && (
              <Card sx={{ mt: 2 }}>
                <CardContent>
                  <CategorySummaryTable
                    data={reportData.incomePieData}
                    title="Revenus par catégorie"
                    type="income"
                  />
                </CardContent>
              </Card>
            )}
          </Grid>

          {/* Operations List - RIGHT COLUMN */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Box>
                    <Typography color="textSecondary">Opérations</Typography>
                    <Typography variant="h6">
                      {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(reportData.totalIncome - reportData.totalExpense)}
                    </Typography>
                  </Box>
                  <Button variant="contained" color="success" onClick={() => setExpenseDrawerOpen(true)} size="small">
                    Ajouter
                  </Button>
                </Box>
                <ExpenseList
                  embed
                  filter={getFilter({ date_gte: reportData.startDate, date_lte: reportData.endDate })}
                />
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      ) : (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
          <Typography variant="body1" color="text.secondary">
            Sélectionnez un rapport dans l'historique ou créez-en un nouveau.
          </Typography>
        </Box>
      )}

      {/* Modals and Drawers */}
      <CreateReportModal
        open={isCreateModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onGenerate={handleGenerateReport}
        params={newReportParams}
        onParamsChange={setNewReportParams}
      />

      <CloseReportModal
        open={isCloseModalOpen}
        onClose={() => setCloseModalOpen(false)}
        onConfirm={() => handleConfirmCloseReport(reportData)}
        closingDate={closingDate}
        onDateChange={setClosingDate}
      />

      <AddExpenseDrawer
        open={isExpenseDrawerOpen}
        onClose={() => setExpenseDrawerOpen(false)}
        selectedAccountId={selectedAccountId}
        onSuccess={handleExpenseSuccess}
      />
    </Box>
  );
};
