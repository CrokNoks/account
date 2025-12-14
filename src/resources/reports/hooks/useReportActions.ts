import { useState } from 'react';
import { useNotify } from 'react-admin';
import { supabaseClient } from '../../../supabaseClient';

export const useReportActions = (
  selectedAccountId: string | null,
  fetchAndCalculateReport: any,
  fetchHistory: any,
  setReportData: any,
  setSelectedReportId: any,
  setLoading: any
) => {
  const notify = useNotify();

  // Create Report Modal
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [newReportParams, setNewReportParams] = useState({
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    initialBalance: 0
  });

  // Close Report Modal
  const [isCloseModalOpen, setCloseModalOpen] = useState(false);
  const [closingDate, setClosingDate] = useState(new Date().toISOString().split('T')[0]);

  const handleGenerateReport = async () => {
    if (!selectedAccountId) return;
    setLoading(true);
    try {
      const { startDate, endDate, initialBalance } = newReportParams;
      const data = await fetchAndCalculateReport(startDate, endDate || null, initialBalance);

      setReportData(data);
      setSelectedReportId('new');
      setCreateModalOpen(false);
    } catch (error) {
      console.error('Error calculating report:', error);
      notify('Erreur lors du calcul du rapport', { type: 'warning' });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCloseModal = (reportData: any) => {
    if (!reportData) return;

    if (reportData.unreconciledCount > 0) {
      notify(`Impossible de clôturer : il reste ${reportData.unreconciledCount} opération(s) non pointée(s).`, { type: 'warning' });
      return;
    }

    setClosingDate(new Date().toISOString().split('T')[0]);
    setCloseModalOpen(true);
  };

  const handleConfirmCloseReport = async (reportData: any) => {
    if (!selectedAccountId || !reportData) return;

    setLoading(true);
    try {
      const finalReportData: Omit<ReportData, 'pieData' | 'incomePieData'> | null = await fetchAndCalculateReport(
        reportData.startDate,
        closingDate,
        reportData.initialBalance
      );

      if (!finalReportData) throw new Error("Erreur lors du calcul du rapport");

      const { error: reportError } = await supabaseClient
        .from('reports')
        .insert({
          account_id: selectedAccountId,
          start_date: finalReportData.startDate,
          end_date: closingDate,
          data: finalReportData
        });
      if (reportError) throw reportError;

      notify('Rapport clôturé et sauvegardé.', { type: 'success' });
      setCloseModalOpen(false);

      // Refresh and load next period
      const historyData = await fetchHistory();

      if (historyData && historyData.length > 0) {
        const lastReport = historyData[0];
        const lastEndDate = new Date(lastReport.end_date);
        const nextStartDate = new Date(lastEndDate);
        nextStartDate.setDate(nextStartDate.getDate() + 1);
        const nextStartDateStr = nextStartDate.toISOString().split('T')[0];
        const nextInitialBalance = lastReport.data?.netResult || 0;

        const report = await fetchAndCalculateReport(nextStartDateStr, null, nextInitialBalance);
        setReportData(report);
        setSelectedReportId('new');
        setNewReportParams({
          startDate: nextStartDateStr,
          endDate: '',
          initialBalance: nextInitialBalance
        });
      }
    } catch (error: any) {
      notify(`Erreur: ${error.message}`, { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteReport = async (selectedReportId: string) => {
    if (selectedReportId === 'new' || !selectedReportId) return;
    if (!window.confirm('Voulez-vous vraiment supprimer ce rapport archivé ?')) return;

    setLoading(true);
    try {
      const { error } = await supabaseClient
        .from('reports')
        .delete()
        .eq('id', selectedReportId);

      if (error) throw error;

      notify('Rapport supprimé.', { type: 'success' });
      notify('Rapport supprimé.', { type: 'success' });

      const historyData = await fetchHistory();

      if (historyData && historyData.length > 0) {
        const lastReport = historyData[0];
        const lastEndDate = new Date(lastReport.end_date);
        const nextStartDate = new Date(lastEndDate);
        nextStartDate.setDate(nextStartDate.getDate() + 1);
        const nextStartDateStr = nextStartDate.toISOString().split('T')[0];
        const nextInitialBalance = lastReport.data?.netResult || 0;

        const report = await fetchAndCalculateReport(nextStartDateStr, null, nextInitialBalance);
        setReportData(report);
        setSelectedReportId('new');
        setNewReportParams({
          startDate: nextStartDateStr,
          endDate: '',
          initialBalance: nextInitialBalance
        });
      } else {
        const { data: account } = await supabaseClient
          .from('accounts')
          .select('initial_balance')
          .eq('id', selectedAccountId)
          .single();

        const { data: firstExpense } = await supabaseClient
          .from('expenses')
          .select('date')
          .eq('account_id', selectedAccountId)
          .order('date', { ascending: true })
          .limit(1)
          .single();

        let startDate = new Date().toISOString().split('T')[0];
        if (firstExpense) startDate = firstExpense.date;
        const initialBalance = account?.initial_balance || 0;

        const report = await fetchAndCalculateReport(startDate, null, initialBalance);
        setReportData(report);
        setSelectedReportId('new');
        setNewReportParams({
          startDate,
          endDate: '',
          initialBalance
        });
      }
    } catch (error: any) {
      notify(`Erreur: ${error.message}`, { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return {
    // Create Modal
    isCreateModalOpen,
    setCreateModalOpen,
    newReportParams,
    setNewReportParams,
    handleGenerateReport,

    // Close Modal
    isCloseModalOpen,
    setCloseModalOpen,
    closingDate,
    setClosingDate,
    handleOpenCloseModal,
    handleConfirmCloseReport,

    // Delete
    handleDeleteReport
  };
};
