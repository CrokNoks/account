'use client';

import { useMemo, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAccountStore } from '@/features/accounts/model/use-account-store';
import { useCategories } from '@/features/categories/api/use-categories';
import { usePeriods } from '@/features/budgets/api/use-periods';
import { useCategoryOverrunsChart } from '../api/use-overruns';
import { closedPeriodsChronological, defaultOverrunsRange, isRangeInverted } from '../model/overruns-range';

const triggerClass = 'w-[160px] h-8 text-xs font-medium bg-muted/30';

export function CategoryOverrunsChart() {
  const t = useTranslations('Reporting');
  const locale = useLocale();
  const dateLocale = locale === 'fr' ? fr : enUS;
  const { activeAccountId } = useAccountStore();
  const { data: categories } = useCategories(activeAccountId);
  const { data: periods } = usePeriods(activeAccountId);

  const closed = useMemo(() => closedPeriodsChronological(periods), [periods]);
  const choices = useMemo(
    () => (categories ?? []).filter((c) => c.type === 'expense' || c.type === 'savings'),
    [categories],
  );
  const defaults = useMemo(() => defaultOverrunsRange(closed), [closed]);

  const [categoryId, setCategoryId] = useState('');
  const [startOverride, setStartOverride] = useState<string | null>(null);
  const [endOverride, setEndOverride] = useState<string | null>(null);
  const startId = startOverride ?? defaults?.startId ?? '';
  const endId = endOverride ?? defaults?.endId ?? '';
  const inverted = isRangeInverted(closed, startId, endId);

  const { data, isLoading } = useCategoryOverrunsChart(
    activeAccountId,
    categoryId || null,
    inverted ? null : startId || null,
    inverted ? null : endId || null,
  );

  const label = (id: string) => {
    const p = closed.find((x) => x.id === id);
    return p ? format(new Date(p.startDate), 'MMM yy', { locale: dateLocale }) : id;
  };

  const chartData = (data?.points ?? []).map((p) => ({
    name: format(new Date(p.startDate), 'MMM yy', { locale: dateLocale }),
    budget: Math.abs(parseInt(p.budget, 10)) / 100,
    overrun: parseInt(p.overrun, 10) / 100,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('overruns_chart_title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {closed.length === 0 ? (
          <p data-testid="overruns-chart-no-period" className="text-muted-foreground italic">{t('overruns_no_period')}</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-3 items-center">
              <Select value={categoryId} onValueChange={(v) => setCategoryId(v ?? '')}>
                <SelectTrigger aria-label={t('overruns_category')} className="w-[200px] h-8 text-xs font-medium bg-muted/30">
                  <SelectValue placeholder={t('overruns_choose_category')}>
                    {choices.find((c) => c.id === categoryId)?.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {choices.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={startId} onValueChange={(v) => setStartOverride(v)}>
                <SelectTrigger aria-label={t('overruns_from')} className={triggerClass}>
                  <SelectValue>{startId ? label(startId) : undefined}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {closed.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{label(p.id)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={endId} onValueChange={(v) => setEndOverride(v)}>
                <SelectTrigger aria-label={t('overruns_to')} className={triggerClass}>
                  <SelectValue>{endId ? label(endId) : undefined}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {closed.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{label(p.id)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {inverted && <p role="alert" className="text-sm text-rose-600">{t('overruns_range_inverted')}</p>}
            {!categoryId && <p className="text-muted-foreground italic">{t('overruns_pick_category')}</p>}
            {categoryId && !inverted && isLoading && <div className="h-72 bg-muted animate-pulse rounded-xl" />}
            {categoryId && !inverted && data && (
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="budget" stackId="a" name={t('overruns_budget')} fill="#38bdf8" />
                    <Bar dataKey="overrun" stackId="a" name={t('overruns_excess')} fill="#e11d48" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
