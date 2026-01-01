import { useState } from 'react';
import { Loading, useTranslate, useDelete, useNotify, useRefresh, Confirm, useRedirect, Button, useGetList } from 'react-admin';
import { Typography, Grid, Box, IconButton, Tooltip } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import { useAccount } from '../../context/AccountContext';
import { PeriodSelector } from './components/PeriodSelector';
import { usePeriodReport } from './hooks/usePeriodReport';
import { CategoryBudgetTable } from './components/CategoryBudgetTable';
import { ReportSummaryCards } from './components/ReportSummaryCards';
import { ExpenseList } from '../expenses';

export const ReportDashboard = () => {
  const { selectedAccountId } = useAccount();
  const translate = useTranslate();
  const notify = useNotify();
  const refresh = useRefresh();
  const redirect = useRedirect();
  const [deleteOne, { isLoading: isDeleting }] = useDelete();

  // Selected Period State
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);

  // Fetch Data from Backend
  const { data: reportData, loading } = usePeriodReport(selectedPeriodId);

  // Check for any active period to determine if "New Period" button should be shown
  const { data: activePeriods } = useGetList('periods', {
    filter: { account_id: selectedAccountId, is_active: true },
    pagination: { page: 1, perPage: 1 }
  });
  const hasActivePeriod = activePeriods && activePeriods.length > 0;

  const handlePeriodChange = (periodId: string) => {
    setSelectedPeriodId(periodId);
  };

  const handleDeleteClick = () => {
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (selectedPeriodId) {
      deleteOne(
        'periods',
        { id: selectedPeriodId, previousData: reportData?.period },
        {
          onSuccess: () => {
            notify('ra.notification.deleted', { type: 'info', messageArgs: { smart_count: 1 } });
            setSelectedPeriodId(null);
            setDeleteDialogOpen(false);
            refresh();
          },
          onError: (error: any) => {
            notify(`Error: ${error.message}`, { type: 'warning' });
            setDeleteDialogOpen(false);
          }
        }
      );
    }
  };

  const handleCloseClick = () => {
    setCloseDialogOpen(true);
  };

  const handleCloseConfirm = async () => {
    if (!selectedPeriodId) return;

    try {
      const apiUrl = import.meta.env.VITE_NEST_API_URL || 'http://127.0.0.1:5001/account/us-central1/api';

      // Hack: Use supabase client directly to get token
      const { supabaseClient } = await import('../../supabaseClient');
      const { data: { session } } = await supabaseClient.auth.getSession();
      const token = session?.access_token;

      const response = await fetch(`${apiUrl}/periods/${selectedPeriodId}/close`, {
        method: 'POST',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to close period');

      notify('Période cloturée avec succès', { type: 'success' });
      setCloseDialogOpen(false);
      redirect('/periods/create');

    } catch (error: any) {
      notify(`Erreur: ${error.message}`, { type: 'error' });
      setCloseDialogOpen(false);
    }
  };

  const handleCreateNext = () => {
    redirect('/periods/create');
  };



  if (!selectedAccountId) {
    return (
      <Box p={2}>
        <Typography variant="h6" gutterBottom>
          {translate('app.dashboard.no_account_title')}
        </Typography>
      </Box>
    );
  }

  if (loading) return <Loading />;

  return (
    <Box p={2}>
      {/* Top Bar: Selector */}
      <Box mb={3} display="flex" justifyContent="space-between" alignItems="center">
        <Box display="flex" alignItems="center" gap={2}>
          <PeriodSelector
            selectedPeriodId={selectedPeriodId}
            onPeriodChange={handlePeriodChange}
          />
          {selectedPeriodId && (
            <Tooltip title={translate('ra.action.delete')}>
              <IconButton onClick={handleDeleteClick} color="error" disabled={isDeleting}>
                <DeleteIcon />
              </IconButton>
            </Tooltip>
          )}
        </Box>
        <Box display="flex" gap={2}>
          {reportData?.period?.is_active && (
            <Button
              label="Cloturer la période"
              onClick={handleCloseClick}
              color="primary"
              variant="outlined"
              startIcon={<CloseIcon />}
            />
          )}
          {!hasActivePeriod && (
            <Button
              label="Nouvelle Période"
              onClick={handleCreateNext}
              color="primary"
              variant="contained"
              startIcon={<AddIcon />}
            />
          )}
        </Box>
      </Box>

      <Confirm
        isOpen={deleteDialogOpen}
        title={translate('ra.message.delete_title', { name: 'Period' })}
        content={translate('ra.message.delete_content', { name: 'Period' })}
        onConfirm={handleDeleteConfirm}
        onClose={() => setDeleteDialogOpen(false)}
      />

      <Confirm
        isOpen={closeDialogOpen}
        title="Cloturer la période"
        content="Êtes-vous sûr de vouloir cloturer cette période ? Cela vous redirigera vers la création de la prochaine période."
        onConfirm={handleCloseConfirm}
        onClose={() => setCloseDialogOpen(false)}
      />

      {reportData ? (
        <Grid container spacing={3}>
          {/* Summary Cards */}
          <ReportSummaryCards reportData={reportData} />

          {/* Category Budget Table & Operations List */}
          <Grid size={{ xs: 12, md: 6 }}>
            {/* Expense Categories */}
            <Typography variant="h6" gutterBottom color="error.main">
              {translate('app.menu.categories')} - {translate('app.evolution.expenses')}
            </Typography>
            <CategoryBudgetTable
              data={reportData.categoryBreakdown.filter(item =>
                item.type === 'expense'
              )}
              globalType="expense"
            />

            {/* Income Categories */}
            <Box mt={4}>
              <Typography variant="h6" gutterBottom color="success.main">
                {translate('app.menu.categories')} - {translate('app.evolution.revenues')}
              </Typography>
              <CategoryBudgetTable
                data={reportData.categoryBreakdown.filter(item =>
                  item.type === 'income'
                )}
                globalType="income"
              />
            </Box>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <Typography variant="h6" gutterBottom>
              {translate('app.menu.expenses')}
            </Typography>
            <ExpenseList embed filter={{ date_gte: reportData.period.start_date, date_lte: reportData.period.end_date }} />
          </Grid>
        </Grid>
      ) : (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
          <Typography variant="body1" color="text.secondary">
            {translate('app.dashboard.select_report_prompt')}
          </Typography>
        </Box>
      )}
    </Box>
  );
};
