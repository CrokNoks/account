'use client';

import { useFormatCurrency } from '@/shared/lib/use-format-currency';
import { usePresentAmount } from '../lib/signed-amount';
import { useAccountStore } from '@/features/accounts/model/use-account-store';
import { useReportingStats } from '../api/use-reporting-stats';
import { compositionView, CompositionRow, CompositionSegment } from '../model/forecast-composition';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import type { ReportingStats } from '../model/types';

const segmentColor: Record<CompositionSegment['key'], string> = {
  forecast: 'bg-primary',
  card: 'bg-amber-500',
  bills: 'bg-sky-500',
  reports: 'bg-rose-400',
  budget: 'bg-slate-400',
};

/**
 * Ligne « Budget restant » : sur mobile, cliquable (volet par catégorie) si le budget restant n'est pas nul et si le back
 * fournit un détail non vide. Sur bureau (`lg:`), ni clic ni volet. La liste est affichée telle quelle (aucun calcul).
 */
function BudgetLine({
  detail,
  active,
  className,
  testId,
  children,
}: {
  detail: ReportingStats['budgetRemainingDetail'];
  active: boolean;
  className?: string;
  testId?: string;
  children: (chevron: ReactNode) => ReactNode;
}) {
  const t = useTranslations('Dashboard');
  const formatCurrency = useFormatCurrency();
  const [open, setOpen] = useState(false);
  const expandable = active && !!detail && detail.length > 0;
  const rowClass = cn('flex items-center justify-between gap-2 max-lg:min-h-12', className);
  if (!expandable) {
    return (
      <li data-testid={testId} className={rowClass}>
        {children(null)}
      </li>
    );
  }
  return (
    <li data-testid={testId}>
      <button
        type="button"
        data-testid="budget-toggle"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(rowClass, 'w-full text-left active:bg-muted lg:hidden')}
      >
        {children(
          <ChevronDown
            data-testid="budget-chevron"
            aria-hidden="true"
            className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
          />,
        )}
      </button>
      <div data-testid="budget-row-desktop" className={cn(rowClass, 'max-lg:hidden')}>
        {children(null)}
      </div>
      {open && (
        <ul data-testid="budget-detail" aria-label={t('composition_budget_detail')} className="space-y-1 pb-1 pl-4 text-sm text-muted-foreground lg:hidden">
          {detail.map((d) => (
            <li key={d.categoryId} className="flex items-center justify-between gap-2 min-h-8">
              <span>{d.name}</span>
              <span className="tabular-nums">{formatCurrency(BigInt(d.remaining))}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

/**
 * Composition du prévu (sans carte propre : elle vit dans le bloc hero de `BalanceBar`) : en banque + CB non pointées + factures à venir + reports + arrivé après la fin
 * + budget restant + revenus attendus = prévu. Barre si tout est une sortie du solde en banque, sinon lignes signées. Les
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
                <BudgetLine key={s.key} detail={stats.budgetRemainingDetail} active={s.key === 'budget' && s.amount !== BigInt(0)}>
                  {(chevron) => (
                    <>
                      <span className="flex items-center gap-2 min-w-0">
                        <span className={cn('h-2 w-2 shrink-0 rounded-full', segmentColor[s.key])} />
                        <span className="lg:truncate">{label(s.key)}</span>
                        {chevron}
                      </span>
                      <span className="font-bold tabular-nums">{formatCurrency(s.amount)}</span>
                    </>
                  )}
                </BudgetLine>
              ))}
            </ul>
          </div>
        ) : (
          <ul data-testid="composition-lines" className="space-y-1 text-sm">
            {view.rows.map((row) => (
              <BudgetLine
                key={row.key}
                testId={`line-${row.key}`}
                detail={stats.budgetRemainingDetail}
                active={row.key === 'budget' && row.amount !== BigInt(0)}
                className={cn(row.key === 'forecast' && 'border-t pt-1 font-black')}
              >
                {(chevron) => (
                  <>
                    <span className="flex items-center gap-2">
                      <span>{label(row.key)}</span>
                      {chevron}
                    </span>
                    <span className={cn('font-bold tabular-nums', present(row.amount, 'balance').className)}>
                      {present(row.amount, 'balance').text}
                    </span>
                  </>
                )}
              </BudgetLine>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
