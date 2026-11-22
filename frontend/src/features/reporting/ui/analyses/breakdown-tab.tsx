'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useAccountStore } from '@/features/accounts/model/use-account-store';
import { usePeriods } from '@/features/budgets/api/use-periods';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useFormatCurrency } from '@/shared/lib/use-format-currency';
import { usePeriodComparison } from '../../api/use-period-comparison';
import { defaultComparison, validCompareWith } from '../../model/analysis-periods';
import { spentAmount } from '../../lib/budget-surplus';
import { buildBreakdown } from '../../model/breakdown';
import { ComparisonGap } from '../period-comparison';
import { ChartLegend } from './chart-legend';
import { longPeriodLabel } from './period-label';

const NO_COMPARISON = 'none';
const triggerClass = 'w-[190px] data-[size=default]:h-11 lg:data-[size=default]:h-8 text-sm lg:text-xs font-medium bg-muted/30';

export function BreakdownTab() {
  const formatCurrency = useFormatCurrency();
  const t = useTranslations('Reporting.analyses');
  const tc = useTranslations('Reporting.comparison');
  const locale = useLocale();
  const { activeAccountId } = useAccountStore();
  const { data: periods } = usePeriods(activeAccountId);

  const defaults = useMemo(() => defaultComparison(periods), [periods]);
  const [periodOverride, setPeriodOverride] = useState<string | null>(null);
  const [compareOverride, setCompareOverride] = useState<string | null | undefined>(undefined);
  const periodId = periodOverride ?? defaults.periodId;
  const requestedCompareId = compareOverride === undefined ? defaults.compareWithId : compareOverride;
  // Choisir pour période affichée la période comparée ne doit pas produire des écarts à 0 % présentés comme réels.
  const compareWithId = periodId ? validCompareWith(periods, periodId, requestedCompareId) : requestedCompareId;

  // Le back exige `compareWith` : sans comparaison, la même période est passée et l'écart n'est pas affiché.
  const { data: comparison, isLoading, isError } = usePeriodComparison(activeAccountId, periodId, compareWithId ?? periodId);

  if (!periods) return <div className="h-48 bg-muted animate-pulse rounded-xl" />;
  if (!periodId) {
    return <p data-testid="breakdown-no-period" className="text-muted-foreground">{t('no_closed_period')}</p>;
  }

  // Périodes fermées et période active (libellée « en cours »), comme l'ancien Flux ; seul le défaut exclut l'active.
  const options = [...periods].sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  const labelOf = (id: string | null) => {
    const p = options.find((x) => x.id === id);
    return p ? `${longPeriodLabel(p.startDate, locale)}${p.isActive ? ` (${t('in_progress')})` : ''}` : undefined;
  };
  const breakdown = comparison ? buildBreakdown(comparison) : null;
  const compared = compareWithId !== null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm lg:text-xs text-muted-foreground">
          {t('breakdown.period')}
          <Select value={periodId} onValueChange={(v) => v && setPeriodOverride(v)}>
            <SelectTrigger aria-label={t('breakdown.period')} className={triggerClass}>
              <SelectValue>{labelOf(periodId)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {options.map((p) => (
                <SelectItem key={p.id} value={p.id}>{labelOf(p.id)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="flex items-center gap-2 text-sm lg:text-xs text-muted-foreground">
          {t('breakdown.compare_with')}
          <Select
            value={compareWithId ?? NO_COMPARISON}
            onValueChange={(v) => setCompareOverride(v === NO_COMPARISON ? null : v)}
          >
            <SelectTrigger aria-label={t('breakdown.compare_with')} className={triggerClass}>
              <SelectValue>{compared ? labelOf(compareWithId) : t('breakdown.choose_compare')}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_COMPARISON}>{t('breakdown.choose_compare')}</SelectItem>
              {options.filter((p) => p.id !== periodId).map((p) => (
                <SelectItem key={p.id} value={p.id}>{labelOf(p.id)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      </div>

      {isError && <p role="alert" className="text-sm text-destructive">{t('breakdown.error')}</p>}
      {isLoading && <div className="h-48 bg-muted animate-pulse rounded-xl" />}

      {breakdown && (
        <>
          <div>
            <p className="text-sm text-muted-foreground">{t('breakdown.total_spent')}</p>
            <p data-testid="breakdown-total" className="text-3xl font-bold tabular-nums">{formatCurrency(breakdown.total)}</p>
            {compared ? (
              <p className="text-sm text-muted-foreground">
                {t('breakdown.compare_total', { amount: formatCurrency(breakdown.compareTotal) })}
              </p>
            ) : (
              <p data-testid="breakdown-first-period" className="text-sm text-muted-foreground">{t('breakdown.first_period')}</p>
            )}
          </div>

          {breakdown.rows.length === 0 ? (
            <p className="text-muted-foreground">{t('breakdown.none')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs">{t('breakdown.category')}</TableHead>
                  <TableHead className="text-right text-xs">{t('breakdown.amount')}</TableHead>
                  {compared && <TableHead className="text-right text-xs">{tc('gap')}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {breakdown.rows.map((row) => (
                  <TableRow key={row.categoryId} data-testid="breakdown-row">
                    <TableCell className="py-3 text-sm font-medium">{row.name}</TableCell>
                    <TableCell className="py-3 text-right text-sm tabular-nums">{formatCurrency(spentAmount(BigInt(row.period2Real)).toString())}</TableCell>
                    {compared && (
                      <TableCell className="py-3 text-right">
                        <ComparisonGap item={row} isExpense isSavings={row.isSavings} />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {compared && <ChartLegend items={[]} note={t('breakdown.legend')} />}
        </>
      )}
    </div>
  );
}
