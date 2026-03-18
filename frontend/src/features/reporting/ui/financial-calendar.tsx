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
  isSameMonth, 
  isSameDay, 
  parseISO,
  addWeeks,
  subWeeks
} from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { useAccountStore } from '@/features/accounts/model/use-account-store';
import { useCalendarData } from '../api/use-calendar-data';
import { useCategories } from '@/features/categories/api/use-categories';
import { useLocale } from 'next-intl';
import { CalendarHeader } from './calendar/calendar-header';
import { CalendarGrid } from './calendar/calendar-grid';
import { CalendarDayDetail } from './calendar/calendar-day-detail';
import { CalendarEvent } from '../model/types';

export function FinancialCalendar() {
  const localeStr = useLocale();
  const dateLocale = localeStr === 'fr' ? fr : enUS;
  const { activeAccountId } = useAccountStore();
  
  const [currentDate, setCurrentDate] = React.useState(new Date());
  const [selectedDay, setSelectedDay] = React.useState<Date | null>(null);
  const [view, setView] = React.useState<'month' | 'week'>('month');
  
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;
  
  const { data: events } = useCalendarData(activeAccountId, year, month);
  const { data: categories } = useCategories(activeAccountId);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  
  const calendarStart = view === 'month' 
    ? startOfWeek(monthStart, { weekStartsOn: 1 })
    : startOfWeek(currentDate, { weekStartsOn: 1 });
    
  const calendarEnd = view === 'month'
    ? endOfWeek(monthEnd, { weekStartsOn: 1 })
    : endOfWeek(currentDate, { weekStartsOn: 1 });

  const days = eachDayOfInterval({
    start: calendarStart,
    end: calendarEnd,
  });

  const next = () => {
    if (view === 'month') setCurrentDate(addMonths(currentDate, 1));
    else setCurrentDate(addWeeks(currentDate, 1));
  };

  const prev = () => {
    if (view === 'month') setCurrentDate(subMonths(currentDate, 1));
    else setCurrentDate(subWeeks(currentDate, 1));
  };

  const goToToday = () => setCurrentDate(new Date());

  const getDayEvents = (day: Date) => {
    return events?.filter((e) => isSameDay(parseISO(e.date), day)) || [];
  };

  const getDayTotal = (dayEvents: CalendarEvent[]) => {
    return dayEvents.reduce((sum, e) => sum + BigInt(e.amount), BigInt(0));
  };

  const totals = React.useMemo(() => {
    if (!events) return { income: BigInt(0), expenses: BigInt(0) };
    
    // Only count events that are in the currently displayed days
    const visibleEvents = events.filter(e => {
      const date = parseISO(e.date);
      return days.some(d => isSameDay(d, date));
    });

    return visibleEvents.reduce((acc, e) => {
      const amount = BigInt(e.amount);
      if (amount > 0) acc.income += amount;
      else acc.expenses += amount;
      return acc;
    }, { income: BigInt(0), expenses: BigInt(0) });
  }, [events, days]);

  return (
    <div className="space-y-6">
      <Card className="shadow-sm overflow-hidden border-2">
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
        <CardContent className="p-0">
          <CalendarGrid 
            days={days}
            view={view}
            monthStart={monthStart}
            selectedDay={selectedDay}
            onDayClick={setSelectedDay}
            getDayEvents={getDayEvents}
            getDayTotal={getDayTotal}
            categories={categories}
          />
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex items-center gap-6 text-xs text-muted-foreground px-2">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm border bg-card shadow-sm" />
          <span>Opération réelle</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm border border-dashed bg-muted/30" />
          <span>Prévision récurrente</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary" />
          <span>Aujourd&apos;hui</span>
        </div>
      </div>

      <CalendarDayDetail 
        selectedDay={selectedDay}
        onClose={() => setSelectedDay(null)}
        dayEvents={selectedDay ? getDayEvents(selectedDay) : []}
        dayTotal={selectedDay ? getDayTotal(getDayEvents(selectedDay)) : BigInt(0)}
        dateLocale={dateLocale}
        categories={categories}
      />
    </div>
  );
}
