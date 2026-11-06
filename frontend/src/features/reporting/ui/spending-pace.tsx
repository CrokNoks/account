'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/shared/lib/format';
import { useAccountStore } from '@/features/accounts/model/use-account-store';
import { useSpendingPace } from '../api/use-spending-pace';
import { useTranslations } from 'next-intl';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

/**
 * Rythme de dépense : cumul des sorties par jour de la période choisie, comparé à la période
 * précédente au même jour. Sans précédente : courbe seule, sans phrase d'écart.
 */
export function SpendingPace() {
  const t = useTranslations('Dashboard');
  const { activeAccountId, activePeriodId } = useAccountStore();
  const { data: pace, isLoading } = useSpendingPace(activeAccountId, activePeriodId);

  if (isLoading || !pace) return <div className="h-48 bg-muted animate-pulse rounded-xl border-2" />;

  const gap = pace.gap === null ? null : parseInt(pace.gap, 10);
  const hasPrevious = pace.previousPeriodId !== null;
  const data = pace.points.map((p) => ({
    day: p.day,
    current: parseInt(p.cumulative, 10),
    previous: p.previousCumulative === null ? null : parseInt(p.previousCumulative, 10),
  }));

  return (
    <Card data-testid="spending-pace" className="border-2 shadow-sm h-full overflow-hidden">
      <CardHeader className="bg-muted/10 pb-3">
        <CardTitle className="text-[10px] max-lg:text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {t('pace_title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-3 space-y-2">
        {gap !== null && (
          <p data-testid="pace-gap" className="text-sm font-bold">
            {gap > 0
              ? t('pace_more', { amount: formatCurrency(gap) })
              : gap < 0
                ? t('pace_less', { amount: formatCurrency(-gap) })
                : t('pace_same')}
          </p>
        )}
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">{t('pace_empty')}</p>
        ) : (
          <div className="h-32 lg:h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                <YAxis hide />
                <Tooltip
                  formatter={(value, name) => [formatCurrency(Number(value)), name === 'previous' ? t('pace_previous') : t('pace_current')]}
                  labelFormatter={(day) => t('pace_day', { day: String(day) })}
                />
                <Line type="monotone" dataKey="current" stroke="var(--color-primary, #6366f1)" strokeWidth={2} dot={false} isAnimationActive={false} />
                {hasPrevious && (
                  <Line type="monotone" dataKey="previous" stroke="#94a3b8" strokeWidth={2} strokeDasharray="4 4" dot={false} isAnimationActive={false} />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
