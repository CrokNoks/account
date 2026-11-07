'use client';

import * as React from 'react';
import {
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  parseISO,
  addWeeks,
  subWeeks,
} from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { useAccountStore } from '@/features/accounts/model/use-account-store';
import { useCalendarData } from '../api/use-calendar-data';
import { useCategories } from '@/features/categories/api/use-categories';
import { useLocale, useTranslations } from 'next-intl';
import { CalendarHeader } from './calendar/calendar-header';
import { CalendarGrid } from './calendar/calendar-grid';
import { CalendarDayDetail } from './calendar/calendar-day-detail';
import { CalendarEvent } from '../model/types';

interface FinancialCalendarProps {
  /** Date affichée (mois, ou semaine en vue semaine) ; l'écran la partage avec la liste « À venir ». */
  currentDate: Date;
  onDateChange: (date: Date) => void;
  /** Jour du point bas (ISO `yyyy-MM-dd`) à marquer dans la grille, quand il est connu. */
  lowPointDate?: string | null;
}

export function FinancialCalendar({ currentDate, onDateChange, lowPointDate = null }: FinancialCalendarProps) {
  const t = useTranslations('Reporting.calendar');
  const localeStr = useLocale();
  const dateLocale = localeStr === 'fr' ? fr : enUS;
  const { activeAccountId } = useAccountStore();

  const [selectedDay, setSelectedDay] = React.useState<Date | null>(null);
  const [view, setView] = React.useState<'month' | 'week'>('month');

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);

  const calendarStart = view === 'month' ? startOfWeek(monthStart, { weekStartsOn: 1 }) : startOfWeek(currentDate, { weekStartsOn: 1 });
  const calendarEnd = view === 'month' ? endOfWeek(monthEnd, { weekStartsOn: 1 }) : endOfWeek(currentDate, { weekStartsOn: 1 });

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Une semaine à cheval sur deux mois lit les deux ; sinon les deux lectures visent le même mois (une seule requête).
  const first = view === 'week' ? calendarStart : currentDate;
  const last = view === 'week' ? calendarEnd : currentDate;
  const firstQuery = useCalendarData(activeAccountId, first.getFullYear(), first.getMonth() + 1);
  const lastQuery = useCalendarData(activeAccountId, last.getFullYear(), last.getMonth() + 1);
  const queries = isSameMonth(first, last) ? [firstQuery] : [firstQuery, lastQuery];
  const failed = queries.filter((q) => q.isError).length;

  const events = React.useMemo(() => {
    const byId = new Map<string, CalendarEvent>();
    for (const q of queries) for (const e of q.data ?? []) byId.set(e.id, e);
    return Array.from(byId.values());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstQuery.data, lastQuery.data, view, currentDate]);

  const { data: categories } = useCategories(activeAccountId);

  const next = () => onDateChange(view === 'month' ? addMonths(currentDate, 1) : addWeeks(currentDate, 1));
  const prev = () => onDateChange(view === 'month' ? subMonths(currentDate, 1) : subWeeks(currentDate, 1));
  const goToToday = () => onDateChange(new Date());

  const getDayEvents = (day: Date) => events.filter((e) => isSameDay(parseISO(e.date), day));
  const getDayTotal = (dayEvents: CalendarEvent[]) => dayEvents.reduce((sum, e) => sum + BigInt(e.amount), BigInt(0));

  const totals = React.useMemo(() => {
    const visible = events.filter((e) => {
      const date = parseISO(e.date);
      return days.some((d) => isSameDay(d, date));
    });
    return visible.reduce(
      (acc, e) => {
        const amount = BigInt(e.amount);
        if (amount > 0) acc.income += amount;
        else acc.expenses += amount;
        return acc;
      },
      { income: BigInt(0), expenses: BigInt(0) },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, view, currentDate]);

  const allFailed = failed === queries.length;

  return (
    <section aria-labelledby="echeances-calendar-title" className="space-y-4 rounded-xl border bg-card p-4 lg:p-5">
      <CalendarHeader
        currentDate={currentDate}
        view={view}
        setView={setView}
        onNext={next}
        onPrev={prev}
        onToday={goToToday}
        totals={totals}
        dateLocale={dateLocale}
        calendarStart={calendarStart}
      />

      {failed > 0 && (
        <p role="alert" className="rounded-lg border border-warn/40 p-3 text-sm text-warn">
          {t('load_error')}
        </p>
      )}

      {!allFailed && (
        <CalendarGrid
          days={days}
          view={view}
          monthStart={monthStart}
          selectedDay={selectedDay}
          onDayClick={setSelectedDay}
          getDayEvents={getDayEvents}
          getDayTotal={getDayTotal}
          categories={categories}
          lowPointDate={lowPointDate}
          dateLocale={dateLocale}
        />
      )}

      <ul aria-label={t('legend_label')} className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
        <li className="flex items-center gap-2">
          <span aria-hidden className="h-4 w-6 rounded-sm border-2 border-solid border-foreground/60" />
          {t('legend_real')}
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden className="h-4 w-6 rounded-sm border-2 border-dashed border-foreground/60" />
          {t('legend_recurring')}
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden className="h-4 w-6 rounded-sm border-2 border-primary bg-muted" />
          {t('today')}
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden className="h-3 w-3 rounded-full bg-warn" />
          {t('legend_low_point')}
        </li>
      </ul>

      <CalendarDayDetail
        selectedDay={selectedDay}
        onClose={() => setSelectedDay(null)}
        dayEvents={selectedDay ? getDayEvents(selectedDay) : []}
        dayTotal={selectedDay ? getDayTotal(getDayEvents(selectedDay)) : BigInt(0)}
        dateLocale={dateLocale}
        categories={categories}
      />
    </section>
  );
}
