'use client';

import { AlertTriangle, CheckCircle2, CreditCard, ListChecks, TrendingUp } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from '@/i18n/routing';
import { useFormatCurrency } from '@/shared/lib/use-format-currency';
import { useAccountStore } from '@/features/accounts/model/use-account-store';
import { useAnomalies } from '../api/use-anomalies';
import { useBudgetBreakdown } from '../api/use-budget-breakdown';
import { useReportingStats } from '../api/use-reporting-stats';
import { operationsHref } from '@/features/transactions/model/operations-link';
import { currentOverruns } from '../model/current-overruns';
import { AnomaliesWidget } from './anomalies-widget';

const rowClass =
  'flex items-center justify-between gap-3 p-3 rounded-lg bg-background border shadow-sm text-sm font-medium hover:bg-muted/50 transition-colors';

/**
 * Bloc « À traiter » de l'écran Aujourd'hui : anomalies, CB à pointer (nombre et total des stats) et dépassements en cours (même calcul que la répartition du budget). Chaque ligne mène à
 * l'écran concerné ; sinon « tout est à jour ».
 */
export function ToHandle() {
  const formatCurrency = useFormatCurrency();
  const t = useTranslations('Dashboard');
  const { activeAccountId, activePeriodId } = useAccountStore();
  const { data: anomalies, isLoading: loadingAnomalies, isError: errorAnomalies } = useAnomalies(activeAccountId, activePeriodId);
  const { data: breakdown, isLoading: loadingBreakdown, isError: errorBreakdown } = useBudgetBreakdown(activeAccountId, activePeriodId);
  const { data: stats, isLoading: loadingStats, isError: errorStats } = useReportingStats(activeAccountId, activePeriodId);
  const isLoading = loadingAnomalies || loadingBreakdown || loadingStats;
  const isError = errorAnomalies || errorBreakdown || errorStats;

  // Nombre et total des CB à pointer : fournis par les stats (mêmes données que la composition du prévu).
  const cardCount = stats?.cardCount ?? 0;
  const cardTotal = stats?.cardTotal ?? '0';
  const overruns = currentOverruns(breakdown);
  const hasAnomalies = (anomalies?.length ?? 0) > 0;
  // « Tout est à jour » seulement quand les trois sources ont répondu sans erreur.
  const allGood = !isLoading && !isError && !hasAnomalies && cardCount === 0 && overruns.length === 0;

  return (
    <Card className="border-2 shadow-sm h-full overflow-hidden flex flex-col">
      <CardHeader className="bg-muted/10 pb-3 shrink-0">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <ListChecks className="w-4 h-4 text-primary" />
          {t('todo_title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-2 flex-1 min-h-0 overflow-y-auto space-y-3">
        {isLoading && !isError && (
          <p className="text-sm text-muted-foreground">{t('todo_loading')}</p>
        )}
        {isError && (
          <div role="alert" className="flex items-center gap-2 text-sm font-medium text-warn">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            {t('todo_error')}
          </div>
        )}
        {allGood && (
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <CheckCircle2 className="w-5 h-5" />
            {t('todo_all_good')}
          </div>
        )}
        <AnomaliesWidget embedded />
        {cardCount > 0 && (
          <Link href={operationsHref({ state: 'a_pointer' })} className={rowClass}>
            <span className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-primary" />
              {t('todo_card', { count: cardCount })}
            </span>
            <span className="font-black">{formatCurrency(cardTotal)}</span>
          </Link>
        )}
        {overruns.map((overrun) => (
          <Link key={overrun.categoryId} href={operationsHref({ categoryId: overrun.categoryId })} className={rowClass}>
            <span className="flex items-center gap-2 min-w-0 text-warn">
              <TrendingUp className="w-4 h-4 shrink-0" />
              {t('todo_overrun', { name: overrun.name, amount: formatCurrency(overrun.amount) })}
            </span>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
