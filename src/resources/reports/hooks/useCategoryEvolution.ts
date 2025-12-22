import { useState, useEffect } from 'react';
import { useNotify, useLocale, useTranslate } from 'react-admin';
import { supabaseClient } from '../../../supabaseClient';
import { useAccount } from '../../../context/AccountContext';
import { aggregateEvolutionData, ChartPoint, CategoryStat } from '../../../utils/reportCalculations';

export const useCategoryEvolution = () => {
  const { selectedAccountId } = useAccount();
  const notify = useNotify();
  const locale = useLocale();
  const translate = useTranslate();

  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState<any[]>([]);
  const [categoryData, setCategoryData] = useState<CategoryStat[]>([]);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [firstReport, setFirstReport] = useState<string | null>(null);
  const [lastReport, setLastReport] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!selectedAccountId) return;

      setLoading(true);
      try {
        // Fetch all archived reports
        const { data: reportsData, error: reportsError } = await supabaseClient
          .from('reports')
          .select('id, start_date, end_date, data')
          .eq('account_id', selectedAccountId)
          .order('end_date', { ascending: true });

        if (reportsError) throw reportsError;

        if (!reportsData || reportsData.length === 0) {
          notify('app.evolution.no_reports', { type: 'info' });
          setLoading(false);
          return;
        }

        setReports(reportsData);

        // Calculate first and last report dates
        const first = reportsData[0];
        const last = reportsData[reportsData.length - 1];
        setFirstReport(first.start_date);
        setLastReport(last.end_date);

        // Use utility to aggregate data
        const { chartPoints, categoryStats } = aggregateEvolutionData(reportsData, locale, translate);

        setCategoryData(categoryStats);
        setChartData(chartPoints);

      } catch (error: any) {
        console.error('Error fetching evolution data:', error);
        notify('app.messages.error_loading', { type: 'error' });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedAccountId, notify, locale, translate]);

  return {
    loading,
    reports,
    categoryData,
    chartData,
    firstReport,
    lastReport
  };
};
