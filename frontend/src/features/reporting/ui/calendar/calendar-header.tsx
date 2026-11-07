'use client';

import * as React from 'react';
import { format, type Locale } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import { formatSignedAmount } from '../../lib/signed-amount';

interface CalendarHeaderProps {
  currentDate: Date;
  view: 'month' | 'week';
  setView: (v: 'month' | 'week') => void;
  onNext: () => void;
  onPrev: () => void;
  onToday: () => void;
  totals: { income: bigint; expenses: bigint };
  dateLocale: Locale;
  calendarStart: Date;
}

const choice = (active: boolean) =>
  cn(
    'min-h-11 rounded-lg border px-3 text-sm font-medium transition-colors',
    active ? 'border-foreground bg-foreground text-background' : 'border-border bg-transparent hover:bg-muted',
  );

export function CalendarHeader({
  currentDate,
  view,
  setView,
  onNext,
  onPrev,
  onToday,
  totals,
  dateLocale,
  calendarStart,
}: CalendarHeaderProps) {
  const t = useTranslations('Reporting.calendar');
  const net = totals.income + totals.expenses;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <h2 id="echeances-calendar-title" className="text-base font-semibold capitalize">
          {view === 'month'
            ? format(currentDate, 'MMMM yyyy', { locale: dateLocale })
            : t('week_of', { date: format(calendarStart, 'd MMMM', { locale: dateLocale }) })}
        </h2>

        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label={t('view_label')} className="flex gap-1">
            <button type="button" aria-pressed={view === 'month'} onClick={() => setView('month')} className={choice(view === 'month')}>
              {t('month')}
            </button>
            <button type="button" aria-pressed={view === 'week'} onClick={() => setView('week')} className={choice(view === 'week')}>
              {t('week')}
            </button>
          </div>
          <button type="button" onClick={onToday} className={choice(false)}>
            {t('today')}
          </button>
          <div className="flex gap-1">
            <button type="button" aria-label={t('previous')} onClick={onPrev} className={cn(choice(false), 'w-11 px-0 flex items-center justify-center')}>
              <ChevronLeft aria-hidden className="h-4 w-4" />
            </button>
            <button type="button" aria-label={t('next')} onClick={onNext} className={cn(choice(false), 'w-11 px-0 flex items-center justify-center')}>
              <ChevronRight aria-hidden className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
        <div>
          <dt className="text-muted-foreground">{t('received')}</dt>
          <dd className="font-mono font-medium tabular-nums text-primary">{formatSignedAmount(totals.income)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t('spent')}</dt>
          <dd className="font-mono font-medium tabular-nums">{formatSignedAmount(totals.expenses)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t('net')}</dt>
          <dd className="font-mono font-medium tabular-nums">{formatSignedAmount(net)}</dd>
        </div>
      </dl>
    </div>
  );
}
