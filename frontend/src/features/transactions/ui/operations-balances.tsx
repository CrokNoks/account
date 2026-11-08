'use client';

import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useFormatCurrency } from '@/shared/lib/use-format-currency';
import { useAccountStore } from '@/features/accounts/model/use-account-store';
import { useReportingStats } from '@/features/reporting/api/use-reporting-stats';

const signClass = (value: string) => (parseInt(value, 10) < 0 ? 'text-red-500' : 'text-green-500');

/**
 * Soldes de tête de l'écran Opérations : en banque, à venir et reste à pointer de la période choisie,
 * lus dans les stats (jamais recalculés ici). Ils ne suivent pas les filtres de la liste.
 * Sans période : une explication à la place.
 */
export function OperationsBalances({ hasPeriod }: { hasPeriod: boolean }) {
  const formatCurrency = useFormatCurrency();
  const t = useTranslations('Transactions.balances');
  const { activeAccountId, activePeriodId } = useAccountStore();
  const { data: stats, isLoading } = useReportingStats(activeAccountId, hasPeriod ? activePeriodId : null);

  if (!hasPeriod) {
    return <p data-testid="balances-no-period" className="text-sm text-muted-foreground">{t('no_period')}</p>;
  }
  if (isLoading || !stats) return <div className="h-20 bg-muted animate-pulse rounded-xl border-2" />;

  return (
    <Card className="border-2 shadow-sm p-4 max-lg:p-3 flex flex-row flex-wrap gap-x-8 gap-y-3 max-lg:justify-between">
      <div data-testid="balance-bank">
        <p className="text-[10px] max-lg:text-xs font-bold uppercase tracking-wider text-muted-foreground">{t('bank')}</p>
        <p className={cn('text-lg max-lg:text-xl font-black tracking-tight', signClass(stats.realBankBalance))}>
          {formatCurrency(stats.realBankBalance)}
        </p>
      </div>
      <div data-testid="balance-upcoming">
        <p className="text-[10px] max-lg:text-xs font-bold uppercase tracking-wider text-muted-foreground">{t('upcoming')}</p>
        <p className={cn('text-lg max-lg:text-xl font-black tracking-tight', signClass(stats.upcomingBalance))}>
          {formatCurrency(stats.upcomingBalance)}
        </p>
      </div>
      <div data-testid="balance-to-reconcile">
        <p className="text-[10px] max-lg:text-xs font-bold uppercase tracking-wider text-muted-foreground">{t('to_reconcile')}</p>
        <p className={cn('text-lg max-lg:text-xl font-black tracking-tight', signClass(stats.cardTotal))}>
          {formatCurrency(stats.cardTotal)}
        </p>
        <p className="text-xs text-muted-foreground">{t('to_reconcile_count', { count: stats.cardCount })}</p>
      </div>
    </Card>
  );
}
