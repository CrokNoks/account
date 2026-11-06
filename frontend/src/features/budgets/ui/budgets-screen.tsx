'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useAccountStore } from '@/features/accounts/model/use-account-store';
import { usePeriods } from '../api/use-periods';
import { PeriodSelect } from '@/features/periods/ui/period-select';
import { useBudgetBreakdown } from '@/features/reporting/api/use-budget-breakdown';
import { useReportingStats } from '@/features/reporting/api/use-reporting-stats';
import { overrunAmount } from '@/features/reporting/model/current-overruns';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency } from '@/shared/lib/format';
import { sortBudgetRows } from '../model/sort-budget-lines';
import { ClosedPeriodWarning } from './closed-period-warning';

/** Budgets de la période choisie : chiffres de la période et une seule liste de catégories (lecture). */
export function BudgetsScreen() {
  const t = useTranslations('BudgetsScreen');
  const { activeAccountId, activePeriodId, setActivePeriodId } = useAccountStore();
  const { data: periods } = usePeriods(activeAccountId);
  const { data: stats } = useReportingStats(activeAccountId, activePeriodId);
  const { data: breakdown, isLoading } = useBudgetBreakdown(activeAccountId, activePeriodId);

  useEffect(() => {
    if (periods && periods.length > 0 && !activePeriodId) {
      setActivePeriodId((periods.find((p) => p.isActive) ?? periods[0]).id);
    }
  }, [periods, activePeriodId, setActivePeriodId]);

  const lines = breakdown ? sortBudgetRows(breakdown) : [];
  const period = periods?.find((p) => p.id === activePeriodId);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <PeriodSelect periods={periods} value={activePeriodId} onChange={setActivePeriodId} />
      </div>

      <ClosedPeriodWarning period={period} />

      {stats && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Figure label={t('forecast')} value={formatCurrency(stats.forecastBalance)} />
          <Figure label={t('planned_income')} value={formatCurrency(stats.plannedIncome)} />
          <Figure label={t('total_budgeted')} value={formatCurrency(stats.plannedExpenses)} />
        </div>
      )}

      {isLoading ? (
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      ) : lines.length === 0 ? (
        <p className="text-muted-foreground">{t('empty')}</p>
      ) : (
        <Card className="border-2 shadow-sm">
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('category')}</TableHead>
                  <TableHead className="text-right">{t('real')}</TableHead>
                  <TableHead className="text-right">{t('remaining')}</TableHead>
                  <TableHead className="text-right">{t('budget')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map(({ line, isIncome }) => {
                  const over = isIncome ? 0 : overrunAmount(line);
                  return (
                    <TableRow key={line.categoryId}>
                      <TableCell className="font-medium">{line.name}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(line.real)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {over > 0 ? (
                          <span data-testid="over-budget" className="font-semibold text-destructive">
                            {t('over', { amount: formatCurrency(over) })}
                          </span>
                        ) : (
                          t('left', { amount: formatCurrency(Math.max(0, parseInt(line.remaining, 10))) })
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(line.budget)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <Card className="border-2 shadow-sm">
      <CardContent className="flex flex-col gap-1 py-4">
        <span className="text-[10px] max-lg:text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className="text-2xl font-bold tabular-nums">{value}</span>
      </CardContent>
    </Card>
  );
}
