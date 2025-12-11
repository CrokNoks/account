import { useState, useEffect, useCallback } from 'react';
import { useNotify } from 'react-admin';
import { supabaseClient } from '../../../supabaseClient';

export const useReportData = (selectedAccountId: string | null) => {
  const notify = useNotify();
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<any>(null);
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

    // Calculate Totals
    let totalIncome = 0;
    let totalExpense = 0;
    let reconciledBalance = 0;
    let unreconciledBalance = 0;
    let unreconciledCount = 0;

    const expenseCategoryMap = new Map();
    const incomeCategoryMap = new Map();

    // Initialize maps with typed categories
    allCategories?.forEach(cat => {
      const catData = {
        name: cat.name,
        value: 0,
        color: cat.color,
        budget: cat.budget
      };

      if (cat.type === 'income') {
        incomeCategoryMap.set(cat.id, catData);
      } else if (cat.type === 'expense') {
        expenseCategoryMap.set(cat.id, catData);
      }
      // Categories with no type are not pre-initialized, they will be added based on transaction sign
    });

    expenses?.forEach((exp: any) => {
      const amount = Number(exp.amount);
      const catId = exp.category_id;
      const category = allCategories?.find(c => c.id === catId);

      // Update global totals (based on raw amount sign)
      if (amount > 0) {
        totalIncome += amount;
      } else {
        totalExpense += Math.abs(amount);
      }

      // Update Category Maps
      if (category && category.type === 'income') {
        // It's a known income category
        if (incomeCategoryMap.has(catId)) {
          incomeCategoryMap.get(catId).value += amount;
        }
      } else if (category && category.type === 'expense') {
        // It's a known expense category
        if (expenseCategoryMap.has(catId)) {
          expenseCategoryMap.get(catId).value += -amount; // Invert sign for expense view (positive value = cost)
        }
      } else {
        // No type or unknown category: fallback to amount sign
        const catName = category?.name || 'Sans catégorie';
        const catColor = category?.color || '#ccc';
        const catBudget = category?.budget || null;

        if (amount > 0) {
          if (!incomeCategoryMap.has(catId)) {
            incomeCategoryMap.set(catId, { name: catName, value: 0, color: catColor, budget: catBudget });
          }
          incomeCategoryMap.get(catId).value += amount;
        } else {
          if (!expenseCategoryMap.has(catId)) {
            expenseCategoryMap.set(catId, { name: catName, value: 0, color: catColor, budget: catBudget });
          }
          expenseCategoryMap.get(catId).value += Math.abs(amount);
        }
      }

      if (exp.reconciled) {
        reconciledBalance += amount;
      } else {
        unreconciledBalance += amount;
        unreconciledCount++;
      }
    });

    return {
      startDate,
      endDate: endDate || null,
      initialBalance: Number(initialBalance),
      totalIncome,
      totalExpense,
      netResult: Number(initialBalance) + totalIncome - totalExpense,
      reconciledBalance,
      unreconciledBalance,
      unreconciledCount,
      pieData: Array.from(expenseCategoryMap.values()).filter(c => c.value > 0 || (c.budget && c.budget > 0)), // Keep if value > 0 OR has budget
      incomePieData: Array.from(incomeCategoryMap.values()).filter(c => c.value > 0 || (c.budget && c.budget > 0)), // Keep if value > 0 OR has budget
      expenseCount: expenses?.length || 0
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
    if (!reportData) return;
    // Don't set global loading to avoid UI flash/unmount
    try {
      const data = await fetchAndCalculateReport(
        reportData.startDate,
        reportData.endDate,
        reportData.initialBalance
      );
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
        if (!data.incomePieData) {
          data = await fetchAndCalculateReport(
            archivedReport.start_date,
            archivedReport.end_date,
            data.initialBalance
          );
        }

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
