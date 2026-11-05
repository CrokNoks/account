'use client';

import { useTranslations, useLocale } from 'next-intl';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAccountStore } from '@/features/accounts/model/use-account-store';
import { formatCurrency } from '@/shared/lib/format';
import { useOverrunsByPeriod } from '../api/use-overruns';
import { PeriodOverruns } from '../model/types';

export function OverrunsList({ periods }: { periods: PeriodOverruns[] }) {
  const t = useTranslations('Reporting');
  const locale = useLocale();
  const dateLocale = locale === 'fr' ? fr : enUS;

  if (periods.length === 0) {
    return <p data-testid="overruns-empty" className="text-muted-foreground italic">{t('overruns_no_period')}</p>;
  }

  return (
    <div className="space-y-6">
      {periods.map((p) => (
        <Card key={p.periodId} data-testid="overruns-period">
          <CardHeader>
            <CardTitle>
              {format(new Date(p.startDate), 'dd MMM yyyy', { locale: dateLocale })} →{' '}
              {format(new Date(p.endDate), 'dd MMM yyyy', { locale: dateLocale })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {p.overruns.length === 0 ? (
              <p data-testid="overruns-period-empty" className="text-muted-foreground italic">{t('overruns_none')}</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="py-1">{t('overruns_category')}</th>
                    <th className="py-1 text-right">{t('overruns_budget')}</th>
                    <th className="py-1 text-right">{t('overruns_real')}</th>
                    <th className="py-1 text-right">{t('overruns_excess')}</th>
                  </tr>
                </thead>
                <tbody>
                  {p.overruns.map((o) => (
                    <tr key={o.categoryId} data-testid="overruns-row">
                      <td className="py-1">{o.name}</td>
                      <td className="py-1 text-right">{formatCurrency(BigInt(o.budget).toString().replace('-', ''))}</td>
                      <td className="py-1 text-right">{formatCurrency(o.real)}</td>
                      <td className="py-1 text-right font-semibold text-rose-600">{formatCurrency(o.overrun)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function OverrunsByPeriod() {
  const { activeAccountId } = useAccountStore();
  const { data, isLoading } = useOverrunsByPeriod(activeAccountId);

  if (isLoading) return <div className="h-48 bg-muted animate-pulse rounded-xl" />;
  return <OverrunsList periods={data?.periods ?? []} />;
}
