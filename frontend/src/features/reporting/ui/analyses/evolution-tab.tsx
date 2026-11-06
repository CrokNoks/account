'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Bar, BarChart, CartesianGrid, Line, LineChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAccountStore } from '@/features/accounts/model/use-account-store';
import { CategoryType } from '@/features/categories/model/types';
import { CategorySelector } from '@/features/categories/ui/category-selector';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency } from '@/shared/lib/format';
import { useEvolution } from '../../api/use-evolution';
import { usePeriods } from '@/features/budgets/api/use-periods';
import { useCategoryOverrunsChart } from '../../api/use-overruns';
import { closedPeriodsChronological } from '../../model/analysis-periods';
import { absCents } from '../../model/breakdown';
import { AXIS_TICK, CHART, PX_PER_PERIOD, TOOLTIP_STYLE } from './chart-style';
import { ChartLegend } from './chart-legend';
import { shortPeriodLabel } from './period-label';

const CHOICE_TYPES = [CategoryType.EXPENSE, CategoryType.SAVINGS];

const eur = (cents: unknown) => formatCurrency(Number(cents));
const axisEuros = (cents: unknown) => `${Math.round(Number(cents) / 100)}`;

/** Graphique qui défile horizontalement quand les périodes sont nombreuses (mobile). */
function Scrollable({ count, children }: { count: number; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto" data-testid="chart-scroll">
      <div style={{ minWidth: Math.max(count * PX_PER_PERIOD, 280), height: 280 }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          {children as React.ReactElement}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function EvolutionTab() {
  const t = useTranslations('Reporting.analyses');
  const te = useTranslations('Reporting.analyses.evolution');
  const locale = useLocale();
  const { activeAccountId } = useAccountStore();
  const { data: evolution, isLoading } = useEvolution(activeAccountId);
  const { data: periods } = usePeriods(activeAccountId);
  const [categoryId, setCategoryId] = useState('');

  // Périodes fermées seulement, de la plus ancienne à la plus récente.
  const closedEvolution = useMemo(
    () =>
      (evolution ?? [])
        .filter((d) => !d.isActive)
        .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()),
    [evolution],
  );
  const closed = useMemo(() => closedPeriodsChronological(periods), [periods]);
  const first = closed[0]?.id ?? null;
  const last = closed[closed.length - 1]?.id ?? null;
  const { data: categoryChart, isLoading: loadingCategory } = useCategoryOverrunsChart(
    activeAccountId,
    categoryId || null,
    first,
    last,
  );

  if (isLoading || !periods) return <div className="h-96 bg-muted animate-pulse rounded-xl" />;
  if (closedEvolution.length === 0 && closed.length === 0) {
    return <p data-testid="evolution-no-period" className="text-muted-foreground">{t('no_closed_period')}</p>;
  }

  const totals = closedEvolution.map((d) => ({
    name: shortPeriodLabel(d.startDate, locale),
    total: Number(absCents(d.realExpenses)),
  }));
  const balances = closedEvolution.map((d) => ({
    name: shortPeriodLabel(d.startDate, locale),
    balance: Number(d.realBankBalance),
  }));
  const categoryPoints = (categoryChart?.points ?? []).map((p) => ({
    name: shortPeriodLabel(p.startDate, locale),
    real: Number(absCents(p.real)),
    budget: Number(absCents(p.budget)),
    overrun: BigInt(p.overrun) > BigInt(0),
  }));

  return (
    <div className="space-y-10">
      <section className="space-y-3" aria-labelledby="evo-total">
        <h3 id="evo-total" className="text-base font-semibold">{te('total_title')}</h3>
        <Scrollable count={totals.length}>
          <BarChart data={totals} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={CHART.grid} vertical={false} />
            <XAxis dataKey="name" tick={AXIS_TICK} />
            <YAxis tick={AXIS_TICK} tickFormatter={axisEuros} width={48} />
            <Tooltip {...TOOLTIP_STYLE} formatter={(v) => eur(v)} />
            <Bar dataKey="total" name={te('total_series')} fill={CHART.strong} radius={[4, 4, 0, 0]}>
              <LabelList dataKey="total" position="top" formatter={eur} fill={CHART.text} fontSize={12} />
            </Bar>
          </BarChart>
        </Scrollable>
        <ChartLegend items={[{ label: te('total_series'), kind: 'bar' }]} note={te('total_legend')} />
      </section>

      <section className="space-y-3" aria-labelledby="evo-category">
        <h3 id="evo-category" className="text-base font-semibold">{te('category_title')}</h3>
        <CategorySelector
          accountId={activeAccountId}
          value={categoryId}
          onChange={setCategoryId}
          types={CHOICE_TYPES}
          placeholder={te('choose_category')}
          aria-label={te('category_select')}
          className="w-[220px] h-11 lg:h-8 text-sm lg:text-xs font-medium bg-muted/30"
        />
        {!categoryId && <p className="text-muted-foreground text-sm">{te('pick_category')}</p>}
        {categoryId && loadingCategory && <div className="h-72 bg-muted animate-pulse rounded-xl" />}
        {categoryId && categoryChart && (
          <>
            <Scrollable count={categoryPoints.length}>
              <BarChart data={categoryPoints} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="name" tick={AXIS_TICK} />
                <YAxis tick={AXIS_TICK} tickFormatter={axisEuros} width={48} />
                <Tooltip {...TOOLTIP_STYLE} formatter={(v) => eur(v)} />
                <Bar dataKey="real" name={te('real')} fill={CHART.strong} radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="real" position="top" formatter={eur} fill={CHART.text} fontSize={12} />
                </Bar>
                <Bar dataKey="budget" name={te('budget')} fill={CHART.budget} radius={[4, 4, 0, 0]} />
              </BarChart>
            </Scrollable>
            <Table data-testid="category-evolution-table">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs">{te('period')}</TableHead>
                  <TableHead className="text-right text-xs">{te('real')}</TableHead>
                  <TableHead className="text-right text-xs">{te('budget')}</TableHead>
                  <TableHead className="text-right text-xs">{te('overrun_mark')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categoryPoints.map((p, i) => (
                  <TableRow key={categoryChart.points[i].periodId}>
                    <TableCell className="py-2 text-sm">{p.name}</TableCell>
                    <TableCell className="py-2 text-right text-sm tabular-nums">{eur(p.real)}</TableCell>
                    <TableCell className="py-2 text-right text-sm tabular-nums">{eur(p.budget)}</TableCell>
                    <TableCell className="py-2 text-right text-sm font-semibold text-destructive" data-testid={p.overrun ? 'overrun-mark' : undefined}>
                      {p.overrun ? `▲ ${te('overrun_mark')}` : <span className="font-normal text-muted-foreground">—</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <ChartLegend
              items={[
                { label: te('real'), kind: 'bar' },
                { label: te('budget'), kind: 'bar-budget' },
              ]}
              note={te('category_legend')}
            />
          </>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="evo-balance">
        <h3 id="evo-balance" className="text-base font-semibold">{te('balance_title')}</h3>
        <Scrollable count={balances.length}>
          <LineChart data={balances} margin={{ top: 20, right: 24, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={CHART.grid} vertical={false} />
            <XAxis dataKey="name" tick={AXIS_TICK} />
            <YAxis tick={AXIS_TICK} tickFormatter={axisEuros} width={48} />
            <Tooltip {...TOOLTIP_STYLE} formatter={(v) => eur(v)} />
            <Line type="monotone" dataKey="balance" name={te('balance_series')} stroke={CHART.strong} strokeWidth={2.5} dot={{ r: 4, fill: CHART.strong }}>
              <LabelList dataKey="balance" position="top" formatter={eur} fill={CHART.text} fontSize={12} />
            </Line>
          </LineChart>
        </Scrollable>
        <ChartLegend items={[{ label: te('balance_series'), kind: 'line' }]} note={te('balance_legend')} />
      </section>
    </div>
  );
}
