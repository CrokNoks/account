'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFormatCurrency } from '@/shared/lib/use-format-currency';
import { useAccountStore } from '@/features/accounts/model/use-account-store';
import { usePeriods } from '@/features/budgets/api/use-periods';
import { todayDateOnly } from '@/shared/lib/date-only';
import { useTranslations } from 'next-intl';
import { useBudgetBreakdown } from '../api/use-budget-breakdown';
import { budgetsToWatch } from '../model/budgets-to-watch';
import { periodProgress } from '../model/period-progress';
import { budgetBarClass } from '../lib/signed-amount';
import { spentAmount } from '../lib/budget-surplus';

const abs = (value: string): bigint => (BigInt(value) < BigInt(0) ? -BigInt(value) : BigInt(value));

/**
 * « Budgets à surveiller » de l'accueil mobile : 5 lignes au plus, dans l'ordre de l'écran Budgets,
 * avec un repère « où l'on devrait en être » (part de période écoulée). Mêmes données que la répartition.
 */
export function BudgetsToWatch() {
  const formatCurrency = useFormatCurrency();
  const t = useTranslations('Dashboard');
  const { activeAccountId, activePeriodId } = useAccountStore();
  const { data: breakdown, isLoading } = useBudgetBreakdown(activeAccountId, activePeriodId);
  const { data: periods } = usePeriods(activeAccountId);
  const period = periods?.find((p) => p.id === activePeriodId);
  const progress = periodProgress(period?.startDate, period?.endDate, todayDateOnly());

  if (isLoading) return <div className="h-40 bg-muted animate-pulse rounded-xl" />;

  const lines = budgetsToWatch(breakdown);

  return (
    <Card data-testid="budgets-to-watch" className="border-2 shadow-sm overflow-hidden">
      <CardHeader className="bg-muted/10 pb-3">
        <CardTitle className="text-base font-semibold">{t('watch_title')}</CardTitle>
      </CardHeader>
      <CardContent className="pt-2 space-y-1">
        {lines.length === 0 && <p className="text-sm text-muted-foreground">{t('watch_empty')}</p>}
        {lines.map((line) => {
          // Un réel positif (remboursement) est un excédent : rien de consommé.
          const real = spentAmount(BigInt(line.real));
          const budget = abs(line.budget);
          // Sans budget, du réel remplit toute la barre ; la part est un pourcentage d'affichage, pas un montant.
          const percent = budget === BigInt(0) ? 100 : Number((real * BigInt(10000)) / budget) / 100;
          const over = real > budget;
          return (
            <div key={line.categoryId} data-testid="watch-row" className="min-h-12 flex flex-col justify-center gap-1 py-1">
              <div className="flex justify-between gap-2 text-sm font-medium">
                <span className="truncate">{line.name}</span>
                <span className="whitespace-nowrap text-muted-foreground tabular-nums">
                  {formatCurrency(real.toString())} / {formatCurrency(budget.toString())}
                </span>
              </div>
              <div className="relative h-2 w-full rounded-full bg-secondary">
                <div
                  data-testid="watch-bar"
                  className={`h-full rounded-full ${budgetBarClass(over)}`}
                  style={{ width: `${Math.min(percent, 100)}%` }}
                />
                {progress && (
                  <div
                    data-testid="watch-marker"
                    role="img"
                    aria-label={t('watch_marker')}
                    title={t('watch_marker')}
                    className="absolute -top-1 h-4 w-0.5 bg-foreground"
                    style={{ left: `${Math.round(progress.ratio * 100)}%` }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
