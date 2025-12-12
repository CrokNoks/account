import { useState } from 'react';
import { useNotify, Loading, useRedirect, useTranslate } from 'react-admin';
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
  const translate = useTranslate();
  const isSmall = useIsSmall();
  const redirect = useRedirect();

  // Expense Drawer state
  const [isExpenseDrawerOpen, setExpenseDrawerOpen] = useState(false);
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(null);

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

  const handleRowClick = (id: string): false => {
    setSelectedExpenseId(id);
    setExpenseDrawerOpen(true);
    return false;
  };

  const handleExpenseSuccess = () => {
    notify(selectedExpenseId ? translate('app.action.operation_updated') : translate('app.action.operation_added'), { type: 'success' });
    setExpenseDrawerOpen(false);
    setSelectedExpenseId(null);
    refreshCurrentReport();
  };

  if (!selectedAccountId) {
    return (
      <Box p={2}>
        <Typography variant="h6" gutterBottom>
          {translate('app.dashboard.no_account_title')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {translate('app.dashboard.no_account_desc')}
        </Typography>
      </Box>
    );
  }
  if (loading) return <Loading />;

  return (
    <Box p={2}>
      <Box
        display="flex"
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
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
              {translate('app.dashboard.buttons.close')}
            </Button>
          )}
          {selectedReportId && selectedReportId !== 'new' && (
            <>
              <Button variant="contained" color="primary" onClick={() => setCreateModalOpen(true)}>
                {translate('app.dashboard.buttons.new_report')}
              </Button>
              <Button variant="outlined" color="error" onClick={() => handleDeleteReport(selectedReportId)}>
                {translate('app.dashboard.buttons.delete')}
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
              {translate('app.dashboard.period.title', {
                start: new Date(reportData.startDate).toLocaleDateString('fr-FR'),
                end: reportData.endDate
                  ? translate('app.dashboard.period.to', { date: new Date(reportData.endDate).toLocaleDateString('fr-FR') })
                  : translate('app.dashboard.period.ongoing')
              })}
            </Typography>
          </Grid>

          {/* Summary Cards */}
          <ReportSummaryCards reportData={reportData} isSmall={isSmall} />

          {/* Category Tables - LEFT COLUMN */}
          <Grid size={{ xs: 12, md: 6 }}>
            <CategorySummaryTable
              data={reportData.pieData}
              title={translate('app.dashboard.expenses_by_category')}
              type="expense"
            />

            {reportData.incomePieData && reportData.incomePieData.length > 0 && (

              <CategorySummaryTable
                sx={{ mt: 2 }}
                data={reportData.incomePieData}
                title={translate('app.dashboard.income_by_category')}
                type="income"
              />
            )}
          </Grid>

          {/* Operations List - RIGHT COLUMN */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Box>
                    <Typography color="textSecondary">{translate('app.dashboard.operations')}</Typography>
                    <Typography variant="h6">
                      {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(reportData.totalIncome - reportData.totalExpense)}
                    </Typography>
                  </Box>
                  <Box display="flex" gap={1}>
                    <Button
                      variant="outlined"
                      color="primary"
                      size="small"
                      onClick={() => redirect('/transfers/create')}
                    >
                      {translate('app.dashboard.buttons.transfer')}
                    </Button>
                    <Button
                      variant="contained"
                      color="success"
                      onClick={() => setExpenseDrawerOpen(true)}
                      size="small"
                    >
                      {translate('app.dashboard.buttons.add')}
                    </Button>
                  </Box>
                </Box>
                <ExpenseList
                  embed
                  filter={getFilter({ date_gte: reportData.startDate, date_lte: reportData.endDate })}
                  onRowClick={handleRowClick}
                />
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      ) : (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
          <Typography variant="body1" color="text.secondary">
            {translate('app.dashboard.select_report_prompt')}
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
        onClose={() => {
          setExpenseDrawerOpen(false);
          setSelectedExpenseId(null);
        }}
        selectedAccountId={selectedAccountId}
        onSuccess={handleExpenseSuccess}
        expenseId={selectedExpenseId}
      />
    </Box>
  );
};
