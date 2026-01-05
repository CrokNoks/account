import { useState, useEffect } from 'react';
import { useNotify, useLocale, useTranslate } from 'react-admin';
import { supabaseClient } from '../../../supabaseClient';
import { useAccount } from '../../../context/AccountContext';
import { ChartPoint, CategoryStat } from '../../../utils/reportCalculations';

export const useCategoryEvolution = () => {
  const { selectedAccountId } = useAccount();
  const notify = useNotify();
  const locale = useLocale();
  const translate = useTranslate();

  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState<any[]>([]); // We can keep this if needed, or derived from periods
  const [categoryData, setCategoryData] = useState<CategoryStat[]>([]);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [firstReport, setFirstReport] = useState<string | null>(null);
  const [lastReport, setLastReport] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!selectedAccountId) return;

      setLoading(true);
      try {
        const { data: rawData, error } = await supabaseClient
          .rpc('get_evolution_data', {
            p_account_id: selectedAccountId,
          });

        if (error) throw error;

        if (!rawData || rawData.length === 0) {
          // notify('app.evolution.no_reports', { type: 'info' }); // Optional: don't annoy if just empty
          setCategoryData([]);
          setChartData([]);
          setFirstReport(null);
          setLastReport(null);
          setReports([]);
          setLoading(false);
          return;
        }

        // Process Data
        const periodsMap = new Map<string, ChartPoint>();
        const categoryMap = new Map<string, CategoryStat>();
        const periodsList: any[] = [];

        rawData.forEach((row: any) => {
          // 1. Chart Points (Group by Period)
          if (!periodsMap.has(row.period_id)) {
            const startDate = new Date(row.period_start);
            const endDate = row.period_end ? new Date(row.period_end) : new Date(); // Handle active period
            const reportLabel = `${startDate.toLocaleDateString(locale, { month: 'short', year: '2-digit' })} - ${row.period_end ? endDate.toLocaleDateString(locale, { month: 'short', year: '2-digit' }) : '...'}`;

            periodsMap.set(row.period_id, {
              reportId: row.period_id,
              reportLabel,
              revenue_Total: 0,
              // ... dynamic expense keys
            });

            periodsList.push({
              id: row.period_id,
              start_date: row.period_start,
              end_date: row.period_end
            });
          }

          const point = periodsMap.get(row.period_id)!;
          const amount = Number(row.total_amount);

          if (amount > 0) {
            point.revenue_Total += amount;
          } else {
            // Expense
            const absAmount = Math.abs(amount);
            const catName = row.category_name || translate('resources.categories.uncategorized');

            // Dynamic key for chart lines
            point[`expense_${catName}`] = absAmount;
          }

          // 2. Category Stats (Group by Category)
          // We only track stats for Expenses usually in this view? 
          // The UI splits views by "expenses" vs "revenues".
          // The row has category_type. 

          if (row.category_id) { // explicit category
            const catKey = row.category_name || translate('resources.categories.uncategorized');
            if (!categoryMap.has(catKey)) {
              categoryMap.set(catKey, {
                categoryId: row.category_id,
                name: catKey,
                color: row.category_color || '#ccc',
                totalExpense: 0,
                totalRevenue: 0,
                reportCount: 0,
                min: Infinity,
                max: -Infinity
              });
            }

            const stat = categoryMap.get(catKey)!;
            // If expense
            if (amount <= 0) {
              const absVal = Math.abs(amount);
              stat.totalExpense += absVal;
              stat.reportCount++;
              stat.min = Math.min(stat.min, absVal);
              stat.max = Math.max(stat.max, absVal);
            } else {
              // Revenue logic if needed, but usually 'categoryData' in UI is used for Expenses table
              stat.totalRevenue += amount;
            }
          }
        });

        const sortedChartData = Array.from(periodsMap.values()); // Already ordered by query? Query orders by start_date, so yes if map preserves insertion order (mostly yes)
        // Ensure sort
        // We need original dates to sort correctly if map order isn't guaranteed
        // But the iteration was on sorted rawData, so per-period creation order is correct.

        const sortedCategoryStats = Array.from(categoryMap.values()).sort((a, b) => b.totalExpense - a.totalExpense);

        setChartData(sortedChartData);
        setCategoryData(sortedCategoryStats);
        setReports(periodsList);

        if (periodsList.length > 0) {
          setFirstReport(periodsList[0].start_date);
          setLastReport(periodsList[periodsList.length - 1].end_date);
        }

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
