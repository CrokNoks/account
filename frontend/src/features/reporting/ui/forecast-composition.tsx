'use client';

import { useFormatCurrency } from '@/shared/lib/use-format-currency';
import { usePresentAmount } from '../lib/signed-amount';
import { useAccountStore } from '@/features/accounts/model/use-account-store';
import { useReportingStats } from '../api/use-reporting-stats';
import { compositionView, CompositionRow, CompositionSegment } from '../model/forecast-composition';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

const segmentColor: Record<CompositionSegment['key'], string> = {
  forecast: 'bg-primary',
  card: 'bg-amber-500',
  bills: 'bg-sky-500',
  budget: 'bg-slate-400',
};

/**
 * Composition du prévu (sans carte propre : elle vit dans le bloc hero de `BalanceBar`) : en banque + CB non pointées + factures à venir − budget restant + revenus
 * attendus = prévu. Barre si tout est une sortie du solde en banque, sinon lignes signées. Les
 * montants viennent de « stats » (le prévu n'est jamais recalculé).
 */
export function ForecastComposition() {
  const formatCurrency = useFormatCurrency();
  const present = usePresentAmount();
  const t = useTranslations('Dashboard');
  const { activeAccountId, activePeriodId } = useAccountStore();
  const { data: stats, isLoading } = useReportingStats(activeAccountId, activePeriodId);

  if (isLoading || !stats) return <div className="h-24 bg-muted animate-pulse rounded-xl" />;

  const view = compositionView(stats);
  const label = (key: CompositionRow['key'] | CompositionSegment['key']) => t(`composition_${key}`);

  return (
    <section data-testid="composition" className="border-t pt-4 max-lg:pt-3">
      <h2 className="mb-3 text-base font-semibold">{t('composition_title')}</h2>
      <div>
        {view.mode === 'bar' ? (
          <div data-testid="composition-bar" className="space-y-3">
            <div className="flex h-4 w-full overflow-hidden rounded-full bg-secondary">
              {view.total > BigInt(0) &&
                view.segments
                  .filter((s) => s.amount > BigInt(0))
                  .map((s) => (
                    <div
                      key={s.key}
                      data-testid={`segment-${s.key}`}
                      className={segmentColor[s.key]}
                      style={{ width: `${Number((s.amount * BigInt(10000)) / view.total) / 100}%` }}
                    />
                  ))}
            </div>
            <ul className="grid grid-cols-1 lg:grid-cols-2 gap-x-4 gap-y-1 text-sm">
              {view.segments.map((s) => (
                <li key={s.key} className="flex items-center justify-between gap-2 max-lg:min-h-12">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className={cn('h-2 w-2 shrink-0 rounded-full', segmentColor[s.key])} />
                    <span className="lg:truncate">{label(s.key)}</span>
                  </span>
                  <span className="font-bold tabular-nums">{formatCurrency(s.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <ul data-testid="composition-lines" className="space-y-1 text-sm">
            {view.rows.map((row) => (
              <li
                key={row.key}
                data-testid={`line-${row.key}`}
                className={cn('flex items-center justify-between gap-2 max-lg:min-h-12', row.key === 'forecast' && 'border-t pt-1 font-black')}
              >
                <span>{label(row.key)}</span>
                <span className={cn('font-bold tabular-nums', present(row.amount, 'balance').className)}>
                  {present(row.amount, 'balance').text}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
