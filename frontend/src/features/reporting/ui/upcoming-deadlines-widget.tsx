'use client';

import { useCalendarData } from '../api/use-calendar-data';
import { useAccountStore } from '@/features/accounts/model/use-account-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/shared/lib/format';
import { Clock, CalendarDays } from 'lucide-react';
import { format, isAfter, startOfDay, addDays, parseISO } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { useLocale, useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { CalendarEvent } from '../model/types';

export function UpcomingDeadlinesWidget() {
  const t = useTranslations('Reporting.deadlines');
  const dateLocale = useLocale() === 'fr' ? fr : enUS;
  const { activeAccountId } = useAccountStore();
  
  // La fenêtre de 7 jours peut déborder sur le mois suivant : il est lu à part (même requête quand elle n'y déborde pas).
  const now = startOfDay(new Date());
  const next7Days = addDays(now, 7);
  const { data: events, isLoading } = useCalendarData(activeAccountId, now.getFullYear(), now.getMonth() + 1);
  const { data: nextEvents, isError: nextMonthFailed, isLoading: nextMonthLoading } = useCalendarData(
    activeAccountId,
    next7Days.getFullYear(),
    next7Days.getMonth() + 1,
  );
  const spansTwoMonths = now.getMonth() !== next7Days.getMonth() || now.getFullYear() !== next7Days.getFullYear();

  // Un seul état de chargement couvre les deux mois : pas de total partiel qui change quand le second arrive.
  if (isLoading || (spansTwoMonths && nextMonthLoading)) return <div className="h-64 bg-muted animate-pulse rounded-xl" />;

  const byId = new Map<string, CalendarEvent>();
  for (const e of [...(events ?? []), ...(spansTwoMonths ? (nextEvents ?? []) : [])]) byId.set(e.id, e);

  const inWindow = Array.from(byId.values())
    .filter(e => {
      const date = parseISO(e.date);
      return isAfter(date, now) && !isAfter(date, next7Days);
    })
    .sort((a, b) => a.date.localeCompare(b.date));
  const upcoming = inWindow.slice(0, 5);
  const others = inWindow.length - upcoming.length;
  const total = upcoming.reduce((sum, e) => sum + parseInt(e.amount, 10), 0);

  return (
    <Card className="h-full border-2 shadow-sm overflow-hidden flex flex-col">
      <CardHeader className="pb-3 bg-muted/10 shrink-0">
        <CardTitle className="text-[10px] max-lg:text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          {t('title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-2 flex-1 overflow-y-auto min-h-0">
        <div className="space-y-4">
          {!upcoming || upcoming.length === 0 ? (
            <div className="h-24 flex flex-col items-center justify-center text-muted-foreground gap-2">
              <CalendarDays className="w-8 h-8 opacity-20" />
              <p className="text-xs max-lg:text-sm italic">{t('none')}</p>
            </div>
          ) : (
            upcoming.map((event) => (
              <div key={event.id} className="flex items-center justify-between gap-4 p-2 rounded-lg hover:bg-muted/50 transition-colors border border-transparent hover:border-border">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex flex-col items-center justify-center w-10 h-10 max-lg:w-12 max-lg:h-12 rounded-xl bg-primary/10 text-primary shrink-0">
                    <span className="text-[10px] max-lg:text-xs uppercase font-bold">{format(parseISO(event.date), 'EEE', { locale: dateLocale })}</span>
                    <span className="text-sm max-lg:text-base font-black leading-none">{format(parseISO(event.date), 'd')}</span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs max-lg:text-sm font-bold truncate">{event.description}</span>
                    <span className="text-[10px] max-lg:text-xs text-muted-foreground uppercase tracking-widest font-medium">
                      {event.type === 'recurring' ? t('recurring') : t('planned')}
                    </span>
                  </div>
                </div>
                <span className={cn(
                  "text-xs max-lg:text-sm font-black tracking-tight shrink-0",
                  parseInt(event.amount, 10) < 0 ? "text-red-500" : "text-green-500"
                )}>
                  {formatCurrency(event.amount)}
                </span>
              </div>
            ))
          )}
        </div>
        {upcoming.length > 0 && (
          <div className="mt-4 border-t pt-3 text-xs max-lg:text-sm">
            <div className="flex items-center justify-between gap-3 font-bold">
              <span className="uppercase tracking-widest text-muted-foreground">{t('total', { count: upcoming.length })}</span>
              <span className={cn("font-black tracking-tight shrink-0", total < 0 ? "text-red-500" : "text-green-500")}>
                {formatCurrency(total)}
              </span>
            </div>
            {others > 0 && <p className="mt-1 text-muted-foreground">{t('others', { count: others })}</p>}
          </div>
        )}
        {spansTwoMonths && nextMonthFailed && (
          <p className="mt-2 text-xs max-lg:text-sm text-muted-foreground">{t('next_month_error')}</p>
        )}
      </CardContent>
    </Card>
  );
}
