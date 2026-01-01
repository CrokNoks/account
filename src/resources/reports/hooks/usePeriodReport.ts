import { useState, useEffect, useCallback } from 'react';
import { supabaseClient } from '../../../supabaseClient';
import { useNotify } from 'react-admin';

const apiUrl = import.meta.env.VITE_NEST_API_URL || 'http://127.0.0.1:5001/account/us-central1/api';

export interface ReportData {
  period: any;
  initialBalance: number;
  totalIncome: number;
  totalExpense: number;
  netResult: number;
  categoryBreakdown: {
    category: any;
    budgeted: number;
    spent: number;
    remaining: number;
    type: string
  }[];
  bankBalance: number;
  futureBalance: number;
  projectedBalance: number;
}

export const usePeriodReport = (periodId: string | null) => {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const notify = useNotify();

  const fetchReport = useCallback(async () => {
    if (!periodId) return;

    setLoading(true);
    try {
      const { data: sessionData } = await supabaseClient.auth.getSession();
      const token = sessionData.session?.access_token;

      const response = await fetch(`${apiUrl}/periods/${periodId}/report`, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : ''
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch report');
      }

      const report = await response.json();
      setData(report);
    } catch (err) {
      console.error(err);
      notify('Erreur lors du chargement du rapport', { type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [periodId, notify]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  return { data, loading, refetch: fetchReport };
};
