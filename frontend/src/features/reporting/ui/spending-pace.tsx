'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFormatCurrency } from '@/shared/lib/use-format-currency';
import { useAccountStore } from '@/features/accounts/model/use-account-store';
import { useSpendingPace } from '../api/use-spending-pace';
import { useLocale, useTranslations } from 'next-intl';
import { paceChartData, paceTicks, paceTooltipAmount, paceYMax, type PaceChartPoint } from '../model/pace-chart';
import { formatShortDate } from '@/shared/lib/date-only';
import { useReportingStats } from '../api/use-reporting-stats';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

/**
 * Rythme de dépense : cumul des sorties par jour de la période choisie, comparé à la période
 * précédente au même jour. Sans précédente : courbe seule, sans phrase d'écart.
 */
export function SpendingPace() {
  const formatCurrency = useFormatCurrency();
  const locale = useLocale();
  const t = useTranslations('Dashboard');
  const { activeAccountId, activePeriodId } = useAccountStore();
  const { data: pace, isLoading } = useSpendingPace(activeAccountId, activePeriodId);
  const { data: stats } = useReportingStats(activeAccountId, activePeriodId);

  if (isLoading || !pace) return <div className="h-48 bg-muted animate-pulse rounded-xl border-2" />;

  const gap = pace.gap === null ? null : BigInt(pace.gap);
  const zero = BigInt(0);
  const hasPrevious = pace.previousPeriodId !== null;
  const data = paceChartData(pace.points);
  // Ligne « Budget » : budget des dépenses et de l'épargne, hors virements (le rythme ne compte pas les virements) ;
  // absente sans budget. Un back plus ancien n'a pas le champ : `plannedExpenses` ne contenait pas les virements.
  const spendingBudget = stats ? (stats.plannedExpensesExTransfers ?? stats.plannedExpenses) : undefined;
  const budget = spendingBudget !== undefined && BigInt(spendingBudget) > zero ? spendingBudget : null;
  const budgetLabel = budget === null ? null : `${t('pace_budget')} ${formatCurrency(budget)}`;
  const dateOf = (day: number) => {
    const date = data.find((p) => p.day === day)?.date;
    return date ? formatShortDate(date, locale) : String(day);
  };

  return (
    <Card data-testid="spending-pace" className="border-2 shadow-sm h-full overflow-hidden">
      <CardHeader className="bg-muted/10 pb-3">
        <CardTitle className="text-base font-semibold">
          {t('pace_title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-3 flex flex-1 flex-col gap-2">
        {gap !== null && (
          <p data-testid="pace-gap" className="text-sm font-bold">
            {gap > zero
              ? t('pace_more', { amount: formatCurrency(gap) })
              : gap < zero
                ? t('pace_less', { amount: formatCurrency(-gap) })
                : t('pace_same')}
          </p>
        )}
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">{t('pace_empty')}</p>
        ) : (
          <div className="h-32 lg:h-auto lg:min-h-40 lg:flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 16, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" ticks={paceTicks(data, 5)} interval={0} padding={{ left: 20, right: 20 }} tickFormatter={dateOf} tick={{ fontSize: 10 }} />
                <YAxis hide domain={[0, paceYMax(data, budget)]} />
                <Tooltip
                  formatter={(_value, name, item) => [
                    paceTooltipAmount(item.payload as PaceChartPoint, name === 'previous' ? 'previous' : 'current', locale),
                    name === 'previous' ? t('pace_previous') : t('pace_current'),
                  ]}
                  labelFormatter={(day) => t('pace_day', { day: String(day) })}
                />
                {budget !== null && (
                  <ReferenceLine
                    y={Number(budget)}
                    stroke="var(--color-warn, #f59e0b)"
                    strokeDasharray="2 4"
                  />
                )}
                <Line type="monotone" dataKey="current" stroke="var(--color-primary, #6366f1)" strokeWidth={2} dot={false} isAnimationActive={false} />
                {hasPrevious && (
                  <Line type="monotone" dataKey="previous" stroke="#94a3b8" strokeWidth={2} strokeDasharray="4 4" dot={false} isAnimationActive={false} />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        {data.length > 0 && (
          <ul data-testid="pace-legend" className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <li className="flex items-center gap-1.5">
              <span aria-hidden className="inline-block h-0.5 w-4 bg-primary" />
              {t('pace_current')}
            </li>
            {hasPrevious && (
              <li className="flex items-center gap-1.5">
                <span aria-hidden className="inline-block w-4 border-t-2 border-dashed border-slate-400" />
                {t('pace_previous')}
              </li>
            )}
            {budgetLabel && (
              <li data-testid="pace-budget" className="flex items-center gap-1.5">
                <span aria-hidden className="inline-block w-4 border-t-2 border-dotted border-warn" />
                {budgetLabel}
              </li>
            )}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
