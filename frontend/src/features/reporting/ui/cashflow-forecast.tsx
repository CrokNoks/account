'use client';

import { addDays, format, parseISO } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { cn } from '@/lib/utils';
import { useFormatCurrency } from '@/shared/lib/use-format-currency';
import { Area, AreaChart, CartesianGrid, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useCashflowForecast } from '../api/use-cashflow-forecast';

export const CASHFLOW_HORIZONS = [30, 60, 90] as const;
export type CashflowHorizon = (typeof CASHFLOW_HORIZONS)[number];

interface CashflowForecastProps {
  accountId: string | null;
  /** Horizon choisi (30 par défaut) ; l'écran le garde pour lire le point bas du même horizon. */
  days?: CashflowHorizon;
  onDaysChange?: (days: CashflowHorizon) => void;
}

/** Jour d'une date ISO du back (`2026-07-15T00:00:00.000Z`) : on garde le jour tel qu'écrit, sans décalage de fuseau. */
const dayOf = (iso: string) => parseISO(iso.slice(0, 10));

/**
 * Courbe de trésorerie : solde du jour puis récurrences, sur 30, 60 ou 90 jours.
 * Le point bas (montant et date) vient du back ; le front ne le recalcule pas.
 */
export function CashflowForecast({ accountId, days = 30, onDaysChange }: CashflowForecastProps) {
  const formatCurrency = useFormatCurrency();
  const t = useTranslations('Reporting.cashflow');
  const dateLocale = useLocale() === 'fr' ? fr : enUS;
  const { data, isLoading, isError } = useCashflowForecast(accountId, days);

  if (!accountId) return null;

  const lowDay = data ? dayOf(data.lowPoint.date) : null;

  // Un point par jour porteur d'événement (solde de fin de journée), borné par aujourd'hui et la fin d'horizon.
  const points = (() => {
    if (!data) return [];
    // Soldes en centimes (texte) : le nombre ne sert qu'à tracer, le libellé de l'infobulle vient du texte exact.
    const byDay = new Map<string, string>();
    const start = data.lowPoint.date;
    const startDay = data.startDate.slice(0, 10);
    byDay.set(startDay, data.currentBalance);
    for (const e of data.events) byDay.set(e.date.slice(0, 10), e.projectedBalance);
    byDay.set(start.slice(0, 10), byDay.get(start.slice(0, 10)) ?? data.lowPoint.balance);
    const last = data.events.length > 0 ? data.events[data.events.length - 1].projectedBalance : data.currentBalance;
    byDay.set(format(addDays(parseISO(startDay), days), 'yyyy-MM-dd'), last);
    return Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, cents]) => ({ time: parseISO(day).getTime(), balance: Number(cents), label: formatCurrency(cents) }));
  })();

  return (
    <section aria-labelledby="echeances-curve-title" className="flex flex-col gap-3 rounded-xl border bg-card p-4 lg:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id="echeances-curve-title" className="text-lg font-semibold">
            {data && lowDay
              ? t('title', {
                  amount: formatCurrency(data.lowPoint.balance),
                  date: format(lowDay, 'd MMMM yyyy', { locale: dateLocale }),
                })
              : t('title_loading')}
          </h2>
          <p className="text-sm text-muted-foreground">{t('scope')}</p>
        </div>

        <div role="group" aria-label={t('horizon_label')} className="flex shrink-0 gap-1">
          {CASHFLOW_HORIZONS.map((h) => (
            <button
              key={h}
              type="button"
              aria-pressed={days === h}
              onClick={() => onDaysChange?.(h)}
              className={cn(
                'min-h-11 min-w-11 rounded-md border-2 px-3 text-sm focus-visible:outline-2 focus-visible:outline-primary',
                days === h ? 'border-primary bg-muted font-semibold underline underline-offset-4' : 'border-transparent text-muted-foreground',
              )}
            >
              {t('horizon_option', { days: h })}
            </button>
          ))}
        </div>
      </div>

      {isError ? (
        <p role="alert" className="rounded-lg border border-warn/40 p-3 text-sm text-warn">
          {t('load_error')}
        </p>
      ) : isLoading || !data ? (
        <div className="h-48 animate-pulse rounded-lg bg-muted" />
      ) : (
        <>
          <div role="img" aria-label={t('chart_label', { days })} className="h-48 w-full lg:h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="time"
                  type="number"
                  scale="time"
                  domain={['dataMin', 'dataMax']}
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v) => format(new Date(Number(v)), 'd MMM', { locale: dateLocale })}
                />
                <YAxis hide domain={['auto', 'auto']} />
                <Tooltip
                  formatter={(_value, _name, item) => [item.payload.label, t('balance')]}
                  labelFormatter={(v) => format(new Date(Number(v)), 'd MMMM yyyy', { locale: dateLocale })}
                />
                <Area
                  type="stepAfter"
                  dataKey="balance"
                  stroke="var(--color-primary, #6366f1)"
                  fill="var(--color-primary, #6366f1)"
                  fillOpacity={0.1}
                  strokeWidth={2}
                  isAnimationActive={false}
                />
                {lowDay && (
                  <ReferenceDot
                    x={lowDay.getTime()}
                    y={Number(data.lowPoint.balance)}
                    r={6}
                    fill="var(--color-warn, #d97706)"
                    stroke="var(--color-background, #fff)"
                    strokeWidth={2}
                    ifOverflow="visible"
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {data.events.length === 0 && (
            <p role="status" className="flex flex-wrap items-center gap-x-3 text-sm text-muted-foreground">
              {t('no_recurring')}
              <Link href="/recurring" className="inline-flex min-h-11 items-center font-medium text-primary hover:underline">
                {t('manage_recurring')}
              </Link>
            </p>
          )}

          <p className="text-sm text-muted-foreground">{t('gap_note')}</p>
          <p className="text-sm text-muted-foreground">{t('bills_note')}</p>
        </>
      )}
    </section>
  );
}
