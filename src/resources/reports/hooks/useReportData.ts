import { useState, useEffect, useCallback } from 'react';
import { useNotify } from 'react-admin';
import { supabaseClient } from '../../../supabaseClient';
import { calculateReportTotals } from '../../../utils/reportCalculations';

export const useReportData = (selectedAccountId: string | null) => {
  const notify = useNotify();
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string>('');

  const fetchAndCalculateReport = useCallback(async (startDate: string, endDate: string | null, initialBalance: number) => {
    if (!selectedAccountId) return null;

    // Fetch Categories
    const { data: allCategories } = await supabaseClient
      .from('categories')
      .select('id, name, color, budget, type')
      .eq('account_id', selectedAccountId);

    // Fetch Expenses
    let query = supabaseClient
      .from('expenses')
      .select(`
                id,
                amount,
                description,
                date,
                reconciled,
                category_id
            `)
      .eq('account_id', selectedAccountId)
      .gte('date', startDate);

    if (endDate) {
      query = query.lte('date', endDate);
    }

    const { data: expenses, error: expensesError } = await query;
    if (expensesError) throw expensesError;

    // Use utility for calculation
    const totals = calculateReportTotals(
      expenses || [],
      allCategories || [],
      Number(initialBalance)
    );

    return {
      startDate,
      endDate: endDate || null,
      initialBalance: Number(initialBalance),
      ...totals
    };
  }, [selectedAccountId]);

  const loadCurrentReport = useCallback(async () => {
    if (!selectedAccountId) return;

    if (history && history.length > 0) {
      const lastReport = history[0];
      const lastEndDate = new Date(lastReport.end_date);
      const nextStartDate = new Date(lastEndDate);
      nextStartDate.setDate(nextStartDate.getDate() + 1);
      const nextStartDateStr = nextStartDate.toISOString().split('T')[0];
      const nextInitialBalance = lastReport.data?.netResult || 0;

      setLoading(true);
      try {
        const report = await fetchAndCalculateReport(nextStartDateStr, null, nextInitialBalance);
        setReportData(report);
        setSelectedReportId('new');
      } catch (e) {
        console.error(e);
        notify('Erreur lors du chargement du rapport en cours', { type: 'error' });
      } finally {
        setLoading(false);
      }
    } else {
      // Pas d'historique : initialiser le premier rapport
      setLoading(true);
      try {
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

        if (firstExpense) {
          const startDate = firstExpense.date;
          const initialBalance = account?.initial_balance || 0;

          const report = await fetchAndCalculateReport(startDate, null, initialBalance);
          setReportData(report);
          setSelectedReportId('new');
        } else {
          setSelectedReportId('new');
          setReportData(null);
        }
      } catch (e) {
        console.error(e);
        notify('Erreur lors de l\'initialisation du rapport', { type: 'error' });
      } finally {
        setLoading(false);
      }
    }
  }, [selectedAccountId, history, fetchAndCalculateReport, notify]);

  const refreshCurrentReport = useCallback(async () => {
    // If no reportData, there's nothing to refresh relative to current dates
    // BUT we need to check if we are in 'new' mode (current report) or 'archived'
    if (!reportData) return;

    try {
      const data = await fetchAndCalculateReport(
        reportData.startDate,
        reportData.endDate,
        reportData.initialBalance
      );
      // We need to spread to force React update if the reference check fails, though setReportData usually triggers rerender
      // But if the object content is same, we want to be sure. 
      // Actually fetchAndCalculateReport returns a new object.
      setReportData(data);
    } catch (error) {
      console.error(error);
    }
  }, [reportData, fetchAndCalculateReport]);

  const fetchHistory = useCallback(async () => {
    if (!selectedAccountId) return;

    const { data: historyData } = await supabaseClient
      .from('reports')
      .select('id, start_date, end_date, data')
      .eq('account_id', selectedAccountId)
      .order('end_date', { ascending: false });

    setHistory(historyData || []);
    return historyData || [];
  }, [selectedAccountId]);

  // Initialize dashboard
  useEffect(() => {
    const initDashboard = async () => {
      if (!selectedAccountId) return;

      const historyData = await fetchHistory();

      if (historyData && historyData.length > 0) {
        const lastReport = historyData[0];
        const lastEndDate = new Date(lastReport.end_date);
        const nextStartDate = new Date(lastEndDate);
        nextStartDate.setDate(nextStartDate.getDate() + 1);
        const nextStartDateStr = nextStartDate.toISOString().split('T')[0];
        const nextInitialBalance = lastReport.data?.netResult || 0;

        setLoading(true);
        try {
          const report = await fetchAndCalculateReport(nextStartDateStr, null, nextInitialBalance);
          setReportData(report);
          setSelectedReportId('new');
        } catch (e) {
          console.error(e);
          notify('Erreur lors du calcul du rapport automatique', { type: 'warning' });
        } finally {
          setLoading(false);
        }
      } else {
        // Pas d'historique : créer le premier rapport
        // On récupère les infos du compte et la première opération
        setLoading(true);
        try {
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

          if (firstExpense) {
            // Il y a au moins une opération
            const startDate = firstExpense.date;
            const initialBalance = account?.initial_balance || 0;

            const report = await fetchAndCalculateReport(startDate, null, initialBalance);
            setReportData(report);
            setSelectedReportId('new');
          } else {
            // Pas d'opération du tout : initialiser un rapport vide à partir d'aujourd'hui
            const startDate = new Date().toISOString().split('T')[0];
            const initialBalance = account?.initial_balance || 0;

            const report = await fetchAndCalculateReport(startDate, null, initialBalance);
            setReportData(report);
            setSelectedReportId('new');
          }
        } catch (e) {
          console.error(e);
          notify('Erreur lors de l\'initialisation du rapport', { type: 'warning' });
          setSelectedReportId('');
          setReportData(null);
        } finally {
          setLoading(false);
        }
      }
    };

    initDashboard();
  }, [selectedAccountId, fetchAndCalculateReport, fetchHistory, notify]);

  // Fetch specific report when selected
  useEffect(() => {
    const fetchReportData = async () => {
      if (!selectedAccountId || !selectedReportId || selectedReportId === 'new') return;

      setLoading(true);
      try {
        const { data: archivedReport, error } = await supabaseClient
          .from('reports')
          .select('*')
          .eq('id', selectedReportId)
          .single();

        if (error) throw error;

        let data = archivedReport.data;

        data = await fetchAndCalculateReport(
          archivedReport.start_date,
          archivedReport.end_date,
          data.initialBalance
        );

        setReportData(data);
      } catch (error) {
        console.error('Error fetching report:', error);
        notify('Erreur lors du chargement du rapport', { type: 'warning' });
      } finally {
        setLoading(false);
      }
    };

    fetchReportData();
  }, [selectedAccountId, selectedReportId, fetchAndCalculateReport, notify]);

  return {
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
  };
};
