import { useState } from 'react';
import { useNotify, Loading } from 'react-admin';
import { Card, CardContent, Typography, Grid, Box, Button, Accordion, AccordionSummary, AccordionDetails } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useAccount } from '../../context/AccountContext';
import { CategorySummaryTable } from '../../components/CategorySummaryTable';
import { ExpenseList } from '../expenses';
import { useIsSmall } from '../../hooks/isSmall';
import {
  ReportSummaryCards,
  ReportSelector,
  CloseReportModal,
  AddExpenseDrawer,
  EditExpenseDrawer,
  TransferDrawer
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

const CollapsibleSection = ({ title, children, isSmall }: { title: string, children: React.ReactNode, isSmall: boolean }) => {
  if (isSmall) {
    return (
      <Accordion defaultExpanded={false} sx={{ mb: 2 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">{title}</Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ p: 0 }}>
          <Box p={1}>
            {children}
          </Box>
        </AccordionDetails>
      </Accordion>
    );
  }

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>{title}</Typography>
        {children}
      </CardContent>
    </Card>
  );
};

export const ReportDashboard = () => {
  const { selectedAccountId } = useAccount();
  const notify = useNotify();
  const isSmall = useIsSmall();

  // Add Expense Drawer state
  const [isAddExpenseDrawerOpen, setAddExpenseDrawerOpen] = useState(false);

  // Edit Expense Drawer state
  const [isEditExpenseDrawerOpen, setEditExpenseDrawerOpen] = useState(false);
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(null);

  // Transfer Drawer state
  const [isTransferDrawerOpen, setTransferDrawerOpen] = useState(false);

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
    setEditExpenseDrawerOpen(true);
    return false;
  };

  const handleAddExpenseSuccess = () => {
    notify('Opération ajoutée', { type: 'success' });
    refreshCurrentReport();
  };

  const handleEditExpenseSuccess = () => {
    notify('Opération modifiée', { type: 'success' });
    setEditExpenseDrawerOpen(false);
    setSelectedExpenseId(null);
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
      <ReportSelector
        selectedReportId={selectedReportId}
        history={history}
        onReportChange={handleReportChange}
      >
        {selectedReportId === 'new' && (
          <Button variant="contained" color="secondary" onClick={() => handleOpenCloseModal(reportData)}>
            Clôturer
          </Button>
        )}
        {selectedReportId && selectedReportId !== 'new' && (
          <Button variant="outlined" color="error" onClick={() => handleDeleteReport(selectedReportId)}>
            Supprimer
          </Button>
        )}
      </ReportSelector>

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
          <ReportSummaryCards
            reportData={reportData}
            isSmall={isSmall}
            isClosed={selectedReportId !== 'new'}
          />

          {/* Category Tables - LEFT COLUMN */}
          <Grid size={{ xs: 12, md: 6 }}>
            <CollapsibleSection title="Dépenses par catégorie" isSmall={isSmall}>
              <CategorySummaryTable
                data={reportData.pieData}
                title=""
                type="expense"
              />
            </CollapsibleSection>

            {reportData.incomePieData && reportData.incomePieData.length > 0 && (
              <CollapsibleSection title="Revenus par catégorie" isSmall={isSmall}>
                <CategorySummaryTable
                  data={reportData.incomePieData}
                  title=""
                  type="income"
                />
              </CollapsibleSection>
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
                  {selectedReportId === 'new' && (
                    <Box display="flex" gap={1}>
                      <Button
                        variant="outlined"
                        color="primary"
                        size="small"
                        onClick={() => setTransferDrawerOpen(true)}
                      >
                        Virement
                      </Button>
                      <Button
                        variant="contained"
                        color="success"
                        onClick={() => setAddExpenseDrawerOpen(true)}
                        size="small"
                      >
                        Ajouter
                      </Button>
                    </Box>
                  )}
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
            Sélectionnez un rapport dans l'historique ou créez-en un nouveau.
          </Typography>
        </Box>
      )}

      {/* Modals and Drawers */}


      <CloseReportModal
        open={isCloseModalOpen}
        onClose={() => setCloseModalOpen(false)}
        onConfirm={() => handleConfirmCloseReport(reportData)}
        closingDate={closingDate}
        onDateChange={setClosingDate}
      />

      <AddExpenseDrawer
        open={isAddExpenseDrawerOpen}
        onClose={() => setAddExpenseDrawerOpen(false)}
        selectedAccountId={selectedAccountId}
        onSuccess={handleAddExpenseSuccess}
      />

      <EditExpenseDrawer
        open={isEditExpenseDrawerOpen}
        onClose={() => {
          setEditExpenseDrawerOpen(false);
          setSelectedExpenseId(null);
        }}
        selectedAccountId={selectedAccountId}
        onSuccess={handleEditExpenseSuccess}
        expenseId={selectedExpenseId!}
      />

      <TransferDrawer
        open={isTransferDrawerOpen}
        onClose={() => setTransferDrawerOpen(false)}
        onSuccess={() => {
          setTransferDrawerOpen(false);
          refreshCurrentReport();
        }}
      />
    </Box>
  );
};
